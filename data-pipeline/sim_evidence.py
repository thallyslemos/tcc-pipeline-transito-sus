"""Contratos analíticos SIM-only para a evidência científica.

Este módulo é deliberadamente separado do Gold legado. A Silver v2 preserva
todo o material recebido do SIM e as flags de qualidade; aqui materializamos
somente os óbitos não fetais por causas V01--V89 com ``qa_status = 'ok'``.

O mesmo fato possui dois papéis geográficos (ocorrência e residência). Cada
papel gera um mart nomeado, ambos apontando para a mesma dimensão municipal.
Nenhum mart usa a UF do arquivo como UF da ocorrência/residência.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

Role = Literal["ocorrencia", "residencia"]
ANALYTIC_FILTER = (
    "is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'"
)
MART_FILENAMES: dict[Role, str] = {
    "ocorrencia": "sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet",
    "residencia": "sim_v1_obitos_municipio_mes_residencia_v2.parquet",
}


def _sql_literal(value: str | Path) -> str:
    return str(value).replace("'", "''")


def _sha256(path: Path, *, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_copy(con: duckdb.DuckDBPyConnection, query: str, destino: Path) -> None:
    """Escreve um Parquet novo sem substituir um artefato existente."""
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists():
        raise FileExistsError(f"Destino ja existe; use um snapshot novo: {destino}")

    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{destino.name}.", suffix=".tmp.parquet", dir=destino.parent
    )
    os.close(fd)
    temporary = Path(temporary_name)
    temporary.unlink()
    try:
        con.sql(f"COPY ({query}) TO '{_sql_literal(temporary)}' (FORMAT PARQUET)")
        if not temporary.exists() or temporary.stat().st_size == 0:
            raise ValueError("Mart SIM vazio ou inválido")
        os.replace(temporary, destino)
    finally:
        if temporary.exists():
            temporary.unlink()


def _dimension_paths(
    municipio_path: Path | None,
    populacao_path: Path | None,
    frota_path: Path | None,
) -> tuple[Path | None, Path | None, Path | None]:
    data_dir = settings.resolve(settings.data_dir)
    return (
        municipio_path or data_dir / "ibge_municipios.parquet",
        populacao_path or data_dir / "ibge_populacao.parquet",
        frota_path or settings.resolve("data/gold/frota_municipio_ano.parquet"),
    )


def _has_columns(con: duckdb.DuckDBPyConnection, path: Path, names: set[str]) -> bool:
    if not path.exists():
        return False
    columns = {
        str(row[0]).lower()
        for row in con.sql(
            f"DESCRIBE SELECT * FROM read_parquet('{_sql_literal(path)}')"
        ).fetchall()
    }
    return names.issubset(columns)


def materializar_mart_municipal(
    silver_path: Path,
    *,
    role: Role,
    destino: Path | None = None,
    municipio_path: Path | None = None,
    populacao_path: Path | None = None,
    frota_path: Path | None = None,
    filtro: str = ANALYTIC_FILTER,
) -> Path:
    """Materializa um mart mensal para ocorrência ou residência.

    A ausência de população/frota não elimina o numerador: as taxas ficam
    nulas e recebem um status explícito. O mart mantém linhas sem vínculo
    geográfico para que a auditoria dos totais não seja silenciosamente
    reduzida; a camada de mapa deve filtrar ``geografia_status = 'encontrado'``.
    """
    silver_path = Path(silver_path)
    if not silver_path.exists():
        raise FileNotFoundError(f"Silver SIM não encontrado: {silver_path}")
    if role not in MART_FILENAMES:
        raise ValueError(f"Papel geográfico inválido: {role}")

    destino = Path(destino) if destino else (
        settings.resolve(settings.gold_dir) / MART_FILENAMES[role]
    )
    municipio_path, populacao_path, frota_path = _dimension_paths(
        municipio_path, populacao_path, frota_path
    )

    code_6 = f"cod_mun_{role}_6"
    name = f"municipio_{role}"
    uf = f"uf_{role}"
    geo_status = f"geografia_status_{role}"

    con = duckdb.connect(":memory:")
    try:
        has_pop = _has_columns(con, populacao_path, {"cod_mun_ibge", "ano", "populacao"})
        has_frota = _has_columns(con, frota_path, {"cod_mun_ibge", "ano", "frota_total"})
        if municipio_path and municipio_path.exists():
            has_municipio = _has_columns(
                con, municipio_path, {"cod_mun_ibge", "nome", "uf"}
            )
        else:
            has_municipio = False

        if has_municipio:
            # A dimensão é role-playing: a mesma tabela é lida duas vezes, uma
            # para cada papel. O agrupamento mantém o código não encontrado.
            dim_join = f"""
                LEFT JOIN (
                    SELECT cod_mun_ibge, nome, uf,
                           ROW_NUMBER() OVER (
                               PARTITION BY LEFT(CAST(cod_mun_ibge AS VARCHAR), 6)
                               ORDER BY cod_mun_ibge
                           ) AS rn
                    FROM read_parquet('{_sql_literal(municipio_path)}')
                ) dim
                  ON LEFT(CAST(dim.cod_mun_ibge AS VARCHAR), 6) = s.{code_6}
                 AND dim.rn = 1
            """
            canonical_code = "CAST(dim.cod_mun_ibge AS VARCHAR)"
            municipality_name = "dim.nome"
            municipality_uf = "dim.uf"
        else:
            dim_join = ""
            canonical_code = "CAST(NULL AS VARCHAR)"
            municipality_name = "CAST(NULL AS VARCHAR)"
            municipality_uf = "CAST(NULL AS VARCHAR)"

        pop_join = ""
        pop_value = "CAST(NULL AS BIGINT)"
        if has_pop:
            pop_join = f"""
                LEFT JOIN read_parquet('{_sql_literal(populacao_path)}') pop
                  ON LEFT(CAST(pop.cod_mun_ibge AS VARCHAR), 6) = s.{code_6}
                 AND CAST(pop.ano AS INTEGER) = s.ano_obito
            """
            pop_value = "CAST(pop.populacao AS BIGINT)"

        fleet_join = ""
        fleet_value = "CAST(NULL AS BIGINT)"
        if has_frota:
            fleet_join = f"""
                LEFT JOIN read_parquet('{_sql_literal(frota_path)}') fleet
                  ON LEFT(CAST(fleet.cod_mun_ibge AS VARCHAR), 6) = s.{code_6}
                 AND CAST(fleet.ano AS INTEGER) = s.ano_obito
            """
            fleet_value = "CAST(fleet.frota_total AS BIGINT)"

        source = f"""
            SELECT
                COALESCE({canonical_code}, s.{code_6}) AS cod_mun_ibge,
                s.{code_6} AS cod_mun_ibge_6,
                COALESCE({municipality_name}, s.{name}) AS municipio,
                COALESCE({municipality_uf}, s.{uf}) AS uf,
                s.{geo_status} AS geografia_status,
                DATE_TRUNC('month', s.dt_obito) AS competencia,
                s.ano_obito AS ano,
                s.mes_obito AS mes,
                s.tipo_veiculo,
                s.faixa_etaria,
                s.sexo,
                s.sexo_desc,
                COUNT(*) AS total_obitos,
                COUNT(DISTINCT s.record_id) AS registros_unicos,
                {pop_value} AS populacao_estimada,
                {fleet_value} AS frota_total
            FROM read_parquet('{_sql_literal(silver_path)}') s
            {dim_join}
            {pop_join}
            {fleet_join}
            WHERE {filtro}
            GROUP BY
                COALESCE({canonical_code}, s.{code_6}), s.{code_6},
                COALESCE({municipality_name}, s.{name}),
                COALESCE({municipality_uf}, s.{uf}), s.{geo_status},
                DATE_TRUNC('month', s.dt_obito), s.ano_obito, s.mes_obito,
                s.tipo_veiculo, s.faixa_etaria, s.sexo, s.sexo_desc,
                {pop_value}, {fleet_value}
        """

        query = f"""
            SELECT
                '{role}' AS tipo_local,
                cod_mun_ibge,
                cod_mun_ibge_6,
                municipio,
                uf,
                geografia_status,
                competencia,
                ano,
                mes,
                tipo_veiculo,
                faixa_etaria,
                sexo,
                sexo_desc,
                total_obitos,
                registros_unicos,
                populacao_estimada,
                CASE WHEN populacao_estimada IS NULL OR populacao_estimada <= 0
                     THEN 'indisponivel' ELSE 'disponivel' END AS populacao_status,
                CASE WHEN populacao_estimada IS NULL OR populacao_estimada <= 0
                     THEN NULL
                     ELSE total_obitos * 100000.0 / populacao_estimada END
                    AS taxa_obitos_100mil,
                frota_total,
                CASE WHEN frota_total IS NULL OR frota_total <= 0
                     THEN 'indisponivel' ELSE 'disponivel' END AS frota_status,
                CASE WHEN frota_total IS NULL OR frota_total <= 0
                     THEN NULL
                     ELSE total_obitos * 10000.0 / frota_total END
                    AS taxa_obitos_10mil_veiculos
            FROM ({source}) grouped
            ORDER BY competencia, cod_mun_ibge, tipo_veiculo, faixa_etaria, sexo
        """
        _atomic_copy(con, query, destino)
    finally:
        con.close()

    logger.info(
        "sim_mart_municipal_materializado",
        role=role,
        destino=str(destino),
    )
    return destino


def materializar_marts_sim(
    silver_path: Path,
    *,
    destino_dir: Path | None = None,
    municipio_path: Path | None = None,
    populacao_path: Path | None = None,
    frota_path: Path | None = None,
) -> dict[Role, Path]:
    """Gera as duas projeções role-playing a partir da mesma Silver v2."""
    destino_dir = Path(destino_dir or settings.resolve(settings.gold_dir))
    return {
        role: materializar_mart_municipal(
            silver_path,
            role=role,
            destino=destino_dir / MART_FILENAMES[role],
            municipio_path=municipio_path,
            populacao_path=populacao_path,
            frota_path=frota_path,
        )
        for role in ("ocorrencia", "residencia")
    }


def auditar_snapshot_sim(
    silver_path: Path,
    *,
    manifest_path: Path | None = None,
    output_path: Path | None = None,
) -> dict[str, Any]:
    """Produz um relatório JSON de qualidade do snapshot Silver v2."""
    silver_path = Path(silver_path)
    if not silver_path.exists():
        raise FileNotFoundError(silver_path)
    con = duckdb.connect(":memory:")
    try:
        columns = [
            {"name": row[0], "type": row[1]}
            for row in con.sql(
                f"DESCRIBE SELECT * FROM read_parquet('{_sql_literal(silver_path)}')"
            ).fetchall()
        ]
        column_names = {item["name"] for item in columns}
        divergence_occurrence = (
            "uf_arquivo_diverge_ocorrencia"
            if "uf_arquivo_diverge_ocorrencia" in column_names
            else "FALSE"
        )
        divergence_residence = (
            "uf_arquivo_diverge_residencia"
            if "uf_arquivo_diverge_residencia" in column_names
            else "FALSE"
        )
        summary = con.sql(
            f"""
            SELECT
                COUNT(*) AS linhas_silver,
                COUNT(DISTINCT record_id) AS record_ids_unicos,
                COUNT(*) FILTER (WHERE {ANALYTIC_FILTER}) AS att_analiticos,
                COUNT(*) FILTER (WHERE is_v01_v89) AS att_todos,
                COUNT(*) FILTER (WHERE is_v01_v89 AND tipobito_raw = '2')
                    AS att_nao_fetais,
                MIN(dt_obito) AS data_minima,
                MAX(dt_obito) AS data_maxima,
                COUNT(DISTINCT ano_obito) AS anos,
                COUNT(DISTINCT uf_ocorrencia) AS ufs_ocorrencia,
                COUNT(*) FILTER (WHERE sexo_desc = 'Ignorado') AS sexo_ignorado,
                COUNT(*) FILTER (WHERE qa_status = 'review') AS linhas_review,
                COUNT(*) FILTER (WHERE geografia_status_ocorrencia = 'encontrado')
                    AS ocorrencia_geo_encontrada,
                COUNT(*) FILTER (WHERE geografia_status_residencia = 'encontrado')
                    AS residencia_geo_encontrada,
                COUNT(*) FILTER (WHERE {divergence_occurrence})
                    AS uf_arquivo_diverge_ocorrencia,
                COUNT(*) FILTER (WHERE {divergence_residence})
                    AS uf_arquivo_diverge_residencia
            FROM read_parquet('{_sql_literal(silver_path)}')
            """
        ).fetchone()
        years = [
            {"ano": int(row[0]), "linhas": int(row[1]), "att": int(row[2])}
            for row in con.sql(
                f"""
                SELECT ano_obito, COUNT(*), COUNT(*) FILTER (WHERE {ANALYTIC_FILTER})
                FROM read_parquet('{_sql_literal(silver_path)}')
                GROUP BY ano_obito ORDER BY ano_obito
                """
            ).fetchall()
        ]
        geography = [
            {
                "papel": str(row[0]),
                "status": str(row[1]),
                "linhas_att": int(row[2]),
            }
            for row in con.sql(
                f"""
                SELECT 'ocorrencia', geografia_status_ocorrencia,
                       COUNT(*) FILTER (WHERE {ANALYTIC_FILTER})
                FROM read_parquet('{_sql_literal(silver_path)}')
                GROUP BY geografia_status_ocorrencia
                UNION ALL
                SELECT 'residencia', geografia_status_residencia,
                       COUNT(*) FILTER (WHERE {ANALYTIC_FILTER})
                FROM read_parquet('{_sql_literal(silver_path)}')
                GROUP BY geografia_status_residencia
                ORDER BY 1, 2
                """
            ).fetchall()
        ]
    finally:
        con.close()

    row_keys = [
        "linhas_silver",
        "record_ids_unicos",
        "att_analiticos",
        "att_todos",
        "att_nao_fetais",
        "data_minima",
        "data_maxima",
        "anos",
        "ufs_ocorrencia",
        "sexo_ignorado",
        "linhas_review",
        "ocorrencia_geo_encontrada",
        "residencia_geo_encontrada",
        "uf_arquivo_diverge_ocorrencia",
        "uf_arquivo_diverge_residencia",
    ]
    summary_dict = {
        key: (value.isoformat() if hasattr(value, "isoformat") else int(value))
        for key, value in zip(row_keys, summary, strict=True)
    }

    manifest = None
    if manifest_path and Path(manifest_path).exists():
        payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        entries = payload.get("entries", [])
        manifest = {
            "path": str(manifest_path),
            "entries": len(entries),
            "approved": sum(e.get("status") == "approved" for e in entries),
            "duplicate_copies": sum(int(e.get("duplicate_copies", 0)) - 1 for e in entries),
        }

    report: dict[str, Any] = {
        "contract": "sim_evidence_v1",
        "generated_at": datetime.now(UTC).isoformat(),
        "silver": {
            "path": str(silver_path),
            "bytes": silver_path.stat().st_size,
            "sha256": _sha256(silver_path),
            "schema": columns,
        },
        "manifest": manifest,
        "analytic_filter": ANALYTIC_FILTER,
        "summary": summary_dict,
        "por_ano": years,
        "geografia": geography,
        "validacoes": {
            "record_id_unico": summary_dict["linhas_silver"]
            == summary_dict["record_ids_unicos"],
            "att_nao_fetais_consistente": summary_dict["att_nao_fetais"]
            == summary_dict["att_todos"],
            "taxas_sem_denominador_nao_calculadas": True,
            "coordenadas_nao_requeridas": True,
        },
    }

    # ``todos_att_nao_fetais`` precisa ser derivado com a mesma consulta, mas
    # não exige manter a conexão aberta nem recontar o Parquet no consumidor.
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if output_path.exists():
            raise FileExistsError(f"Relatório já existe: {output_path}")
        output_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    return report
