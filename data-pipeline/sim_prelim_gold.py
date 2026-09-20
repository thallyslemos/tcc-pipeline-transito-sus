"""Gold SIM PRELIMINAR: marts municipio-mes, camada paralela a consolidada.

Espelha `sim_evidence.materializar_mart_municipal`, com duas diferencas
deliberadas pedidas para esta camada:

1. `total_obitos` usa `COUNT(DISTINCT record_id)`, nunca `COUNT(*)`. A
   consolidada usa `COUNT(*)` como contagem principal (reportando
   `COUNT(DISTINCT record_id)` so como auxiliar de auditoria) porque a Silver
   v2 ja e QA'd; a preliminar tem menos garantia de deduplicacao, entao a
   contagem primaria aqui e a mais conservadora.
2. Carrega is_preliminar/data_extracao/arquivo_origem/sha256_origem.

DADOS PRELIMINARES NUNCA ENTRAM NA MESMA AGREGACAO QUE OS CONSOLIDADOS: este
modulo so le a Silver PRELIMINAR (sim_prelim_nacional.parquet) e so escreve
em data/gold/sim_prelim_*.parquet — nunca em data/gold/sim_v1_*.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import duckdb

from .config import settings
from .logging import get_logger
from .sim_evidence import ANALYTIC_FILTER, _atomic_copy, _dimension_paths, _has_columns, _sql_literal

logger = get_logger(__name__)

Role = Literal["ocorrencia", "residencia"]
PRELIM_MART_FILENAMES: dict[Role, str] = {
    "ocorrencia": "sim_prelim_municipio_mes_ocorrencia.parquet",
    "residencia": "sim_prelim_municipio_mes_residencia.parquet",
}


def materializar_mart_prelim_municipal(
    silver_path: Path,
    *,
    role: Role,
    destino: Path | None = None,
    municipio_path: Path | None = None,
    populacao_path: Path | None = None,
    frota_path: Path | None = None,
    filtro: str = ANALYTIC_FILTER,
) -> Path:
    """Materializa o mart PRELIMINAR mensal para ocorrencia ou residencia."""
    silver_path = Path(silver_path)
    if not silver_path.exists():
        raise FileNotFoundError(f"Silver SIM PRELIMINAR nao encontrado: {silver_path}")
    if role not in PRELIM_MART_FILENAMES:
        raise ValueError(f"Papel geografico invalido: {role}")

    destino = Path(destino) if destino else (
        settings.resolve(settings.gold_dir) / PRELIM_MART_FILENAMES[role]
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
            has_municipio = _has_columns(con, municipio_path, {"cod_mun_ibge", "nome", "uf"})
        else:
            has_municipio = False

        if has_municipio:
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
                COUNT(DISTINCT s.record_id) AS total_obitos,
                COUNT(*) AS registros_brutos,
                {pop_value} AS populacao_estimada,
                {fleet_value} AS frota_total,
                MAX(s.data_extracao) AS data_extracao,
                STRING_AGG(DISTINCT s.arquivo_origem, '; ') AS arquivo_origem,
                STRING_AGG(DISTINCT s.sha256_origem, '; ') AS sha256_origem
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
                registros_brutos,
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
                    AS taxa_obitos_10mil_veiculos,
                TRUE AS is_preliminar,
                data_extracao,
                arquivo_origem,
                sha256_origem
            FROM ({source}) grouped
            ORDER BY competencia, cod_mun_ibge, tipo_veiculo, faixa_etaria, sexo
        """
        _atomic_copy(con, query, destino)
    finally:
        con.close()

    logger.info("sim_prelim_mart_municipal_materializado", role=role, destino=str(destino))
    return destino


def materializar_marts_prelim(
    silver_path: Path,
    *,
    destino_dir: Path | None = None,
) -> dict[Role, Path]:
    """Materializa os dois marts PRELIMINARES (ocorrencia e residencia)."""
    destino_dir = Path(destino_dir) if destino_dir else settings.resolve(settings.gold_dir)
    resultado: dict[Role, Path] = {}
    for role in ("ocorrencia", "residencia"):
        resultado[role] = materializar_mart_prelim_municipal(
            silver_path,
            role=role,
            destino=destino_dir / PRELIM_MART_FILENAMES[role],
        )
    return resultado
