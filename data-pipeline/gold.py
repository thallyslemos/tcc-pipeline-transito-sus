"""Camada Gold - views agregadas prontas para consumo.

Gera Parquet com agregacoes por municipio e competencia,
otimizadas para consultas dos dashboards e MCP Server.

Quando existem Parquets IBGE (ibge_municipios, ibge_populacao),
enriquece com nome, lat, lon e populacao estimada.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def _ibge_paths() -> tuple[Path, Path]:
    data_dir = settings.resolve(settings.data_dir)
    return data_dir / "ibge_municipios.parquet", data_dir / "ibge_populacao.parquet"


def gerar_gold_obitos(silver_sim: Path) -> Path:
    """Gera tabela Gold de obitos agregados por municipio/mes.

    Se existirem ibge_municipios.parquet e ibge_populacao.parquet,
    enriquece com lat, lon, municipio (nome IBGE) e populacao.
    """
    if not silver_sim.exists():
        msg = f"Silver SIM nao encontrado: {silver_sim}. Execute o pipeline ETL antes."
        raise FileNotFoundError(msg)

    destino = settings.resolve(settings.gold_dir) / "obitos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    ibge_mun_path, ibge_pop_path = _ibge_paths()
    has_ibge_mun = ibge_mun_path.exists()
    has_ibge_pop = ibge_pop_path.exists()

    con = duckdb.connect(":memory:")

    cols = [c[0] for c in con.sql(f"DESCRIBE SELECT * FROM '{silver_sim}'").fetchall()]
    has_municipio = "municipio" in cols
    municipio_expr = "municipio" if has_municipio else "cod_mun_ocorrencia"

    base_sql = f"""
        SELECT
            cod_mun_ocorrencia      AS cod_mun_ibge,
            {municipio_expr}        AS municipio,
            uf,
            competencia,
            YEAR(competencia)       AS ano,
            MONTH(competencia)      AS mes,
            COUNT(*)                AS total_obitos,
            tipo_veiculo,
            faixa_etaria,
            sexo_desc               AS sexo
        FROM read_parquet('{silver_sim}')
        GROUP BY cod_mun_ocorrencia, {municipio_expr}, uf, competencia,
                 tipo_veiculo, faixa_etaria, sexo_desc
    """

    if has_ibge_mun and has_ibge_pop:
        con.sql(f"""
            COPY (
                SELECT
                    base.cod_mun_ibge,
                    COALESCE(ibge.nome, base.municipio) AS municipio,
                    base.uf,
                    base.competencia,
                    base.ano,
                    base.mes,
                    base.total_obitos,
                    base.tipo_veiculo,
                    base.faixa_etaria,
                    base.sexo,
                    ibge.lat,
                    ibge.lon,
                    pop.populacao AS populacao_estimada
                FROM ({base_sql}) base
                LEFT JOIN read_parquet('{ibge_mun_path}') ibge
                    ON LEFT(base.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)
                LEFT JOIN read_parquet('{ibge_pop_path}') pop
                    ON LEFT(base.cod_mun_ibge, 6) = LEFT(pop.cod_mun_ibge, 6)
                    AND base.ano = pop.ano
                ORDER BY base.competencia, base.cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)
    elif has_ibge_mun:
        con.sql(f"""
            COPY (
                SELECT
                    base.cod_mun_ibge,
                    COALESCE(ibge.nome, base.municipio) AS municipio,
                    base.uf,
                    base.competencia,
                    base.ano,
                    base.mes,
                    base.total_obitos,
                    base.tipo_veiculo,
                    base.faixa_etaria,
                    base.sexo,
                    ibge.lat,
                    ibge.lon,
                    CAST(NULL AS INTEGER) AS populacao_estimada
                FROM ({base_sql}) base
                LEFT JOIN read_parquet('{ibge_mun_path}') ibge
                    ON LEFT(base.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)
                ORDER BY base.competencia, base.cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)
    else:
        con.sql(f"""
            COPY (
                SELECT
                    base.cod_mun_ibge,
                    base.municipio,
                    base.uf,
                    base.competencia,
                    base.ano,
                    base.mes,
                    base.total_obitos,
                    base.tipo_veiculo,
                    base.faixa_etaria,
                    base.sexo,
                    CAST(NULL AS DOUBLE) AS lat,
                    CAST(NULL AS DOUBLE) AS lon,
                    CAST(NULL AS INTEGER) AS populacao_estimada
                FROM ({base_sql}) base
                ORDER BY base.competencia, base.cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)

    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info(
        "gold_obitos_gerado",
        registros=total,
        caminho=str(destino),
        enriquecido_ibge=has_ibge_mun,
    )
    return destino


def gerar_gold_custos(silver_sia: Path) -> Path:
    """Gera tabela Gold de custos agregados por municipio/mes.

    IMPORTANTE sobre campos financeiros (SIA/PA):
    ================================================
    PA_VALAPR (valor_aprovado no Silver):
        Valor Aprovado em Reais (R$). Representa o valor financeiro
        TOTAL aprovado pelo gestor para pagamento do procedimento.
        Este valor JA E O TOTAL do registro - NAO multiplicar por quantidade.

        Fonte: Tabela de Procedimentos do SUS (SIGTAP)
        Referencia: http://sigtap.datasus.gov.br

    PA_QTDAPR (qtd_aprovada no Silver):
        Quantidade de procedimentos aprovados. Usado para contagem
        de procedimentos, NAO para calculo de valor total.

    Calculo do custo total por municipio/mes:
        custo_total = SUM(valor_aprovado)
        (somatorio simples, sem multiplicacao por quantidade)

    Referencia do layout:
        DATASUS - SIA/PA Layout: https://wiki.saude.gov.br/sia/index.php
        Informe Tecnico SIA: Ministerio da Saude, 2019
    """
    if not silver_sia.exists():
        msg = f"Silver SIA nao encontrado: {silver_sia}. Execute o pipeline ETL antes."
        raise FileNotFoundError(msg)

    destino = settings.resolve(settings.gold_dir) / "custos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    ibge_mun_path, _ = _ibge_paths()
    has_ibge_mun = ibge_mun_path.exists()

    con = duckdb.connect(":memory:")

    cols = [c[0] for c in con.sql(f"DESCRIBE SELECT * FROM '{silver_sia}'").fetchall()]
    has_municipio = "municipio" in cols
    municipio_expr = "municipio" if has_municipio else "cod_mun"

    base_sql = f"""
        SELECT
            cod_mun                 AS cod_mun_ibge,
            {municipio_expr}        AS municipio,
            uf,
            competencia,
            YEAR(competencia)       AS ano,
            MONTH(competencia)      AS mes,
            SUM(valor_aprovado)     AS custo_total,
            SUM(qtd_aprovada)       AS total_procedimentos,
            COUNT(*)                AS total_atendimentos,
            tipo_veiculo,
            faixa_etaria
        FROM read_parquet('{silver_sia}')
        GROUP BY cod_mun, {municipio_expr}, uf, competencia,
                 tipo_veiculo, faixa_etaria
    """

    if has_ibge_mun:
        con.sql(f"""
            COPY (
                SELECT
                    base.cod_mun_ibge,
                    COALESCE(ibge.nome, base.municipio) AS municipio,
                    base.uf,
                    base.competencia,
                    base.ano,
                    base.mes,
                    base.custo_total,
                    base.total_procedimentos,
                    base.total_atendimentos,
                    base.tipo_veiculo,
                    base.faixa_etaria,
                    ibge.lat,
                    ibge.lon
                FROM ({base_sql}) base
                LEFT JOIN read_parquet('{ibge_mun_path}') ibge
                    ON LEFT(base.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)
                ORDER BY base.competencia, base.cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)
    else:
        con.sql(f"""
            COPY (
                SELECT
                    base.cod_mun_ibge,
                    base.municipio,
                    base.uf,
                    base.competencia,
                    base.ano,
                    base.mes,
                    base.custo_total,
                    base.total_procedimentos,
                    base.total_atendimentos,
                    base.tipo_veiculo,
                    base.faixa_etaria,
                    CAST(NULL AS DOUBLE) AS lat,
                    CAST(NULL AS DOUBLE) AS lon
                FROM ({base_sql}) base
                ORDER BY base.competencia, base.cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)

    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info(
        "gold_custos_gerado",
        registros=total,
        caminho=str(destino),
        enriquecido_ibge=has_ibge_mun,
    )
    return destino
