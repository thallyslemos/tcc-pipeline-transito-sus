"""Camada Gold — views agregadas prontas para consumo.

Gera Parquet com agregações por município e competência,
otimizadas para consultas dos dashboards e MCP Server.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


MUNICIPIOS = {
    "3550308": "São Paulo",
    "3106200": "Belo Horizonte",
    "2933307": "Vitória da Conquista",
}


def gerar_gold_obitos(silver_sim: Path) -> Path:
    """Gera tabela Gold de óbitos agregados por município/mês.

    Args:
        silver_sim: Caminho do Parquet Silver do SIM.

    Returns:
        Caminho do Parquet Gold gerado.
    """
    destino = settings.resolve(settings.gold_dir) / "obitos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    mun_case = " ".join(
        f"WHEN cod_mun_ocorrencia = '{cod}' THEN '{nome}'" for cod, nome in MUNICIPIOS.items()
    )

    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT
                cod_mun_ocorrencia      AS cod_mun_ibge,
                CASE {mun_case}
                    ELSE 'Outro'
                END                     AS municipio,
                uf,
                competencia,
                YEAR(competencia)       AS ano,
                MONTH(competencia)      AS mes,
                COUNT(*)                AS total_obitos,
                tipo_veiculo,
                faixa_etaria,
                sexo_desc               AS sexo
            FROM read_parquet('{silver_sim}')
            GROUP BY
                cod_mun_ocorrencia, uf, competencia,
                tipo_veiculo, faixa_etaria, sexo_desc
            ORDER BY competencia, cod_mun_ocorrencia
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("gold_obitos_gerado", registros=total, caminho=str(destino))
    return destino


def gerar_gold_custos(silver_sia: Path) -> Path:
    """Gera tabela Gold de custos agregados por município/mês.

    Args:
        silver_sia: Caminho do Parquet Silver do SIA.

    Returns:
        Caminho do Parquet Gold gerado.
    """
    destino = settings.resolve(settings.gold_dir) / "custos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    mun_case = " ".join(
        f"WHEN cod_mun = '{cod}' THEN '{nome}'" for cod, nome in MUNICIPIOS.items()
    )

    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT
                cod_mun                 AS cod_mun_ibge,
                CASE {mun_case}
                    ELSE 'Outro'
                END                     AS municipio,
                uf,
                competencia,
                YEAR(competencia)       AS ano,
                MONTH(competencia)      AS mes,
                SUM(valor_aprovado)     AS custo_total,
                SUM(qtd_aprovada)       AS total_procedimentos,
                COUNT(*)               AS total_atendimentos,
                tipo_veiculo,
                faixa_etaria
            FROM read_parquet('{silver_sia}')
            GROUP BY
                cod_mun, uf, competencia,
                tipo_veiculo, faixa_etaria
            ORDER BY competencia, cod_mun
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("gold_custos_gerado", registros=total, caminho=str(destino))
    return destino
