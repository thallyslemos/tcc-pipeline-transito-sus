"""Silver SIM PRELIMINAR: mesmo contrato do Silver v2, camada paralela.

Espelha ~95% de `silver_v2.processar_silver_sim_v2` (mesma extracao de
idade/sexo/geografia, mesma classificacao `is_v01_v89` por prefixo numerico do
CID — nunca `BETWEEN` sobre a string completa do codigo). Duplicado em vez de
parametrizado para nao acoplar a camada consolidada (ja testada e em uso) a
um formato de manifesto diferente: o manifesto preliminar carrega proveniencia
do `.dbc` bruto (`dbc_sha256`, `extracted_at`, `dbc_source_reference`), que o
manifesto consolidado nao tem.

DADOS PRELIMINARES NUNCA ENTRAM NA MESMA AGREGACAO QUE OS CONSOLIDADOS: este
modulo nunca le nem escreve em data/silver/sim_v2*.parquet.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

DEFAULT_LAYOUT_VERSION = "sim_prelim_0_1"


def _sql_literal(value: str | Path) -> str:
    return str(value).replace("'", "''")


def _read_prelim_sources(
    bronze_path: Path,
    *,
    manifest_path: Path | None = None,
) -> tuple[list[Path], dict[str, dict[str, Any]]]:
    """Resolve fontes aprovadas do manifesto PRELIMINAR (sim_prelim_manifest.json).

    Ao contrario da consolidada, nao ha modo "legado sem manifesto": dados
    preliminares sem proveniencia auditavel (arquivo de origem, data de
    extracao, sha256 do .dbc) nao entram na Silver preliminar.
    """
    bronze_path = Path(bronze_path)
    if not bronze_path.is_dir():
        raise FileNotFoundError(bronze_path)
    manifest_path = Path(manifest_path) if manifest_path else bronze_path / "sim_prelim_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifesto SIM PRELIMINAR ausente: {manifest_path}")
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = payload.get("entries", [])
    approved = [entry for entry in entries if entry.get("status") == "approved"]
    if not approved:
        raise ValueError("Manifesto SIM PRELIMINAR existe, mas nao possui entradas approved")
    paths: list[Path] = []
    metadata: dict[str, dict[str, Any]] = {}
    for entry in approved:
        target = (bronze_path / str(entry["target_path"])).resolve()
        if not target.is_relative_to(bronze_path.resolve()):
            raise ValueError(f"Alvo fora do Bronze PRELIMINAR: {target}")
        if not target.exists():
            raise FileNotFoundError(f"Parte approved ausente: {target}")
        if not entry.get("dbc_sha256") or not entry.get("extracted_at"):
            raise ValueError(
                f"Entrada sem proveniencia completa do .dbc (dbc_sha256/extracted_at): {target}"
            )
        paths.append(target)
        metadata[target.as_posix()] = entry
    return sorted(paths), metadata


def _read_parquet_expr(paths: list[Path]) -> str:
    values = ", ".join(f"'{_sql_literal(path)}'" for path in paths)
    return f"read_parquet([{values}], union_by_name=true, filename=true, file_row_number=true)"


def _columns(paths: list[Path]) -> dict[str, str]:
    source = _read_parquet_expr(paths)
    con = duckdb.connect(":memory:")
    try:
        rows = con.sql(f"DESCRIBE SELECT * FROM {source} LIMIT 0").fetchall()
    finally:
        con.close()
    return {str(row[0]).upper(): str(row[1]) for row in rows}


def _schema_hash(columns: dict[str, str]) -> str:
    encoded = json.dumps(columns, ensure_ascii=True, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _raw(columns: dict[str, str], name: str) -> str:
    if name.upper() not in columns:
        return "CAST(NULL AS VARCHAR)"
    return f'CAST("{name}" AS VARCHAR)'


def _provenance_case(paths: list[Path], metadata: dict[str, dict[str, Any]], field: str) -> str:
    """CASE WHEN source_file_name = ... THEN <metadata[field]> — por arquivo Bronze."""
    clauses: list[str] = []
    for path in paths:
        entry = metadata.get(path.as_posix(), {})
        value = entry.get(field)
        if value:
            clauses.append(f"WHEN source_file_name = '{_sql_literal(path)}' THEN '{_sql_literal(str(value))}'")
    if not clauses:
        return "CAST(NULL AS VARCHAR)"
    return "CASE " + " ".join(clauses) + " ELSE CAST(NULL AS VARCHAR) END"


def _atomic_copy(con: duckdb.DuckDBPyConnection, query: str, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists():
        raise FileExistsError(f"Silver PRELIMINAR ja existe; use destino novo: {destino}")
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{destino.name}.", suffix=".tmp.parquet", dir=destino.parent
    )
    os.close(fd)
    temporary = Path(temporary_name)
    temporary.unlink()
    try:
        con.sql(f"COPY ({query}) TO '{_sql_literal(temporary)}' (FORMAT PARQUET)")
        count = con.sql(
            f"SELECT COUNT(*) FROM read_parquet('{_sql_literal(temporary)}')"
        ).fetchone()[0]
        if count < 0 or temporary.stat().st_size == 0:
            raise ValueError("Silver PRELIMINAR vazia ou invalida")
        os.replace(temporary, destino)
    finally:
        if temporary.exists():
            temporary.unlink()


def processar_silver_sim_prelim(
    bronze_path: Path,
    *,
    destino: Path | None = None,
    layout_version: str = DEFAULT_LAYOUT_VERSION,
    manifest_path: Path | None = None,
) -> Path:
    """Gera a Silver PRELIMINAR (paralela, nunca sobreposta a sim_v2.parquet)."""
    paths, metadata = _read_prelim_sources(Path(bronze_path), manifest_path=manifest_path)
    columns = _columns(paths)
    source = _read_parquet_expr(paths)
    raw_causabas = _raw(columns, "CAUSABAS")
    raw_dt = _raw(columns, "DTOBITO")
    raw_idade = _raw(columns, "IDADE")
    raw_sexo = _raw(columns, "SEXO")
    raw_res = _raw(columns, "CODMUNRES")
    raw_ocor = _raw(columns, "CODMUNOCOR")
    raw_uf = _raw(columns, "UF")
    raw_tipo = _raw(columns, "TIPOBITO")
    dim_path = settings.resolve(settings.data_dir) / "ibge_municipios.parquet"
    schema_hash = _schema_hash(columns)
    destino = destino or settings.resolve(settings.silver_dir) / "sim_prelim_nacional.parquet"

    arquivo_origem_expr = _provenance_case(paths, metadata, "dbc_source_reference")
    sha256_origem_expr = _provenance_case(paths, metadata, "dbc_sha256")
    data_extracao_expr = _provenance_case(paths, metadata, "extracted_at")

    if dim_path.exists():
        geo_cte = f"""
        enriched AS (
            SELECT c.*,
                   occ.cod_mun_ibge AS cod_mun_ocorrencia_ibge,
                   occ.nome AS municipio_ocorrencia,
                   occ.uf AS uf_ocorrencia,
                   res.cod_mun_ibge AS cod_mun_residencia_ibge,
                   res.nome AS municipio_residencia,
                   res.uf AS uf_residencia
            FROM classified c
            LEFT JOIN (
                SELECT cod_mun_ibge, nome, uf,
                       ROW_NUMBER() OVER (
                           PARTITION BY LEFT(CAST(cod_mun_ibge AS VARCHAR), 6)
                           ORDER BY cod_mun_ibge
                       ) AS rn
                FROM read_parquet('{_sql_literal(dim_path)}')
            ) occ
              ON LEFT(CAST(occ.cod_mun_ibge AS VARCHAR), 6) = c.cod_mun_ocorrencia_6
             AND occ.rn = 1
            LEFT JOIN (
                SELECT cod_mun_ibge, nome, uf,
                       ROW_NUMBER() OVER (
                           PARTITION BY LEFT(CAST(cod_mun_ibge AS VARCHAR), 6)
                           ORDER BY cod_mun_ibge
                       ) AS rn
                FROM read_parquet('{_sql_literal(dim_path)}')
            ) res
              ON LEFT(CAST(res.cod_mun_ibge AS VARCHAR), 6) = c.cod_mun_residencia_6
             AND res.rn = 1
        )
        """
    else:
        geo_cte = """
        enriched AS (
            SELECT c.*,
                   CAST(NULL AS VARCHAR) AS cod_mun_ocorrencia_ibge,
                   CAST(NULL AS VARCHAR) AS municipio_ocorrencia,
                   CAST(NULL AS VARCHAR) AS uf_ocorrencia,
                   CAST(NULL AS VARCHAR) AS cod_mun_residencia_ibge,
                   CAST(NULL AS VARCHAR) AS municipio_residencia,
                   CAST(NULL AS VARCHAR) AS uf_residencia
            FROM classified c
        )
        """

    query = f"""
        WITH raw AS (
            SELECT *,
                   CAST(filename AS VARCHAR) AS source_file_name,
                   CAST(file_row_number AS BIGINT) AS source_row_number
            FROM {source}
        ), typed AS (
            SELECT *,
                   NULLIF(TRIM({raw_causabas}), '') AS causabas_raw,
                   UPPER(NULLIF(TRIM({raw_causabas}), '')) AS causabas_clean,
                   NULLIF(TRIM({raw_dt}), '') AS dt_raw,
                   NULLIF(TRIM({raw_idade}), '') AS idade_raw,
                   UPPER(NULLIF(TRIM({raw_sexo}), '')) AS sexo_raw,
                   NULLIF(TRIM({raw_res}), '') AS cod_mun_res_raw,
                   NULLIF(TRIM({raw_ocor}), '') AS cod_mun_ocor_raw,
                   NULLIF(TRIM({raw_uf}), '') AS uf_arquivo,
                   NULLIF(TRIM({raw_tipo}), '') AS tipobito_raw,
                   {arquivo_origem_expr} AS arquivo_origem,
                   {sha256_origem_expr} AS sha256_origem,
                   TRY_CAST({data_extracao_expr} AS TIMESTAMP) AS data_extracao_ts
            FROM raw
        ), decoded AS (
            SELECT *,
                   TRY_CAST(SUBSTR(idade_raw, 1, 1) AS INTEGER) AS idade_unidade_code,
                   TRY_CAST(SUBSTR(idade_raw, 2, 2) AS INTEGER) AS idade_quantidade,
                   TRY_CAST(
                       COALESCE(
                           TRY_STRPTIME(dt_raw, '%d%m%Y'),
                           TRY_CAST(dt_raw AS DATE)
                       ) AS DATE
                   ) AS dt_obito,
                   LEFT(causabas_clean, 3) AS cid_grupo,
                   LEFT(cod_mun_res_raw, 6) AS cod_mun_residencia_6,
                   LEFT(cod_mun_ocor_raw, 6) AS cod_mun_ocorrencia_6
            FROM typed
        ), classified AS (
            SELECT *,
                   CASE
                       WHEN idade_raw IS NULL OR idade_raw IN ('000', '900') THEN NULL
                       WHEN idade_unidade_code IN (0, 1, 2, 3) THEN 0
                       WHEN idade_unidade_code = 4 THEN idade_quantidade
                       WHEN idade_unidade_code = 5 THEN 100 + idade_quantidade
                       ELSE NULL
                   END AS idade_anos,
                   CASE
                       WHEN sexo_raw IN ('1', 'M') THEN 'Masculino'
                       WHEN sexo_raw IN ('2', 'F') THEN 'Feminino'
                       WHEN sexo_raw IN ('0', '9', 'I') THEN 'Ignorado'
                       ELSE NULL
                   END AS sexo_desc,
                   -- Filtro cientifico por PREFIXO do codigo CID (nunca BETWEEN
                   -- sobre a string completa 'V01'..'V89'): extrai os 2 digitos
                   -- numericos apos o 'V' e testa a faixa 1..89 sobre o INTEIRO.
                   CASE
                       WHEN LEFT(cid_grupo, 1) = 'V'
                            AND TRY_CAST(SUBSTR(cid_grupo, 2, 2) AS INTEGER) BETWEEN 1 AND 89
                       THEN TRUE ELSE FALSE
                   END AS is_v01_v89
            FROM decoded
        ),
        {geo_cte}
        SELECT
            sha256(
                CONCAT(COALESCE(sha256_origem, source_file_name), ':', source_row_number)
            ) AS record_id,
            source_file_name,
            source_row_number,
            '{_sql_literal(layout_version)}' AS layout_version,
            '{_sql_literal(schema_hash)}' AS raw_schema_hash,
            causabas_raw,
            causabas_clean AS causabas,
            cid_grupo,
            is_v01_v89,
            dt_raw AS dt_obito_raw,
            dt_obito,
            DATE_TRUNC('month', dt_obito) AS competencia,
            EXTRACT(YEAR FROM dt_obito)::INTEGER AS ano_obito,
            EXTRACT(MONTH FROM dt_obito)::INTEGER AS mes_obito,
            idade_raw,
            idade_unidade_code,
            idade_quantidade,
            idade_anos AS idade,
            idade_anos AS idade_anos,
            CASE WHEN idade_anos IS NULL THEN 'Ignorada'
                 WHEN idade_anos BETWEEN 0 AND 14 THEN '0-14'
                 WHEN idade_anos BETWEEN 15 AND 24 THEN '15-24'
                 WHEN idade_anos BETWEEN 25 AND 34 THEN '25-34'
                 WHEN idade_anos BETWEEN 35 AND 44 THEN '35-44'
                 WHEN idade_anos BETWEEN 45 AND 54 THEN '45-54'
                 WHEN idade_anos BETWEEN 55 AND 64 THEN '55-64'
                 ELSE '65+'
            END AS faixa_etaria,
            sexo_raw,
            CASE WHEN sexo_raw IN ('1', 'M') THEN 1
                 WHEN sexo_raw IN ('2', 'F') THEN 2
                 WHEN sexo_raw IN ('0', '9', 'I') THEN 0
                 ELSE NULL END AS sexo,
            sexo_desc,
            tipobito_raw,
            -- TIPOBITO: 1=Fetal, 2=Nao Fetal (confirmado em
            -- docs/Estrutura_do_SIM_2025.md:25 — "1 - Tipo do obito TIPOBITO
            -- Caracter 1 1 - Fetal; 2-Nao Fetal"). Mesmo codigo da consolidada.
            CASE WHEN tipobito_raw = '1' THEN 'Fetal'
                 WHEN tipobito_raw = '2' THEN 'Nao fetal'
                 ELSE 'Ignorado' END AS tipo_obito,
            CASE WHEN tipobito_raw = '2' THEN TRUE ELSE FALSE END
                AS is_obito_nao_fetal,
            cod_mun_res_raw AS cod_mun_residencia,
            cod_mun_res_raw AS cod_mun_residencia_raw,
            cod_mun_residencia_6,
            cod_mun_residencia_ibge,
            municipio_residencia,
            uf_residencia,
            CASE WHEN cod_mun_residencia_ibge IS NOT NULL THEN 'encontrado'
                 WHEN cod_mun_residencia_6 IS NULL THEN 'codigo_vazio'
                 ELSE 'nao_encontrado' END AS geografia_status_residencia,
            cod_mun_ocor_raw AS cod_mun_ocorrencia,
            cod_mun_ocor_raw AS cod_mun_ocorrencia_raw,
            cod_mun_ocorrencia_6,
            cod_mun_ocorrencia_ibge,
            municipio_ocorrencia,
            uf_ocorrencia,
            CASE WHEN cod_mun_ocorrencia_ibge IS NOT NULL THEN 'encontrado'
                 WHEN cod_mun_ocorrencia_6 IS NULL THEN 'codigo_vazio'
                 ELSE 'nao_encontrado' END AS geografia_status_ocorrencia,
            uf_arquivo,
            CASE
                WHEN dt_obito IS NULL THEN 'data_invalida'
                WHEN causabas_clean IS NULL THEN 'causa_nula'
                WHEN NOT is_v01_v89 THEN 'cid_fora_v01_v89'
                WHEN sexo_desc IS NULL THEN 'sexo_invalido'
                WHEN idade_raw IS NOT NULL AND idade_raw NOT IN ('000', '900')
                     AND idade_unidade_code NOT IN (0, 1, 2, 3, 4, 5)
                    THEN 'idade_invalida'
                ELSE NULL
            END AS qa_flag_principal,
            CASE WHEN dt_obito IS NULL OR causabas_clean IS NULL OR NOT is_v01_v89
                      OR sexo_desc IS NULL THEN 'review' ELSE 'ok' END AS qa_status,
            CASE
                WHEN LEFT(cid_grupo, 1) <> 'V' THEN 'Nao ATT'
                WHEN LEFT(cid_grupo, 2) = 'V0' THEN 'Pedestre'
                WHEN LEFT(cid_grupo, 2) = 'V1' THEN 'Ciclista'
                WHEN LEFT(cid_grupo, 2) = 'V2' THEN 'Motociclista'
                WHEN LEFT(cid_grupo, 2) = 'V3' THEN 'Triciclo'
                WHEN LEFT(cid_grupo, 2) = 'V4' THEN 'Automovel'
                WHEN LEFT(cid_grupo, 2) = 'V5' THEN 'Caminhonete'
                WHEN LEFT(cid_grupo, 2) = 'V6' THEN 'Veiculo pesado'
                WHEN LEFT(cid_grupo, 2) = 'V7' THEN 'Onibus'
                WHEN LEFT(cid_grupo, 2) = 'V8' THEN 'Outros'
                ELSE 'Nao ATT'
            END AS tipo_veiculo,
            -- Colunas obrigatorias da camada preliminar (contrato desta feature).
            TRUE AS is_preliminar,
            CAST(data_extracao_ts AS DATE) AS data_extracao,
            arquivo_origem,
            sha256_origem
        FROM enriched
    """

    con = duckdb.connect(":memory:")
    try:
        _atomic_copy(con, query, Path(destino))
    finally:
        con.close()
    logger.info("silver_sim_prelim_processado", caminho=str(destino), fontes=len(paths))
    return Path(destino)
