"""Camada Gold - views agregadas prontas para consumo.

Gera Parquet com agregacoes por municipio e competencia,
otimizadas para consultas dos dashboards e MCP Server.

Funciona tanto com dados amostrais (sample_data.py) quanto
com dados reais do DATASUS (datasus.py). Quando o campo
'municipio' nao existe no Silver, usa cod_mun como identificador.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def gerar_gold_obitos(silver_sim: Path) -> Path:
    """Gera tabela Gold de obitos agregados por municipio/mes."""
    destino = settings.resolve(settings.gold_dir) / "obitos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    cols = [c[0] for c in con.sql(f"DESCRIBE SELECT * FROM '{silver_sim}'").fetchall()]
    has_municipio = "municipio" in cols

    municipio_expr = "municipio" if has_municipio else "cod_mun_ocorrencia"

    con.sql(f"""
        COPY (
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
    destino = settings.resolve(settings.gold_dir) / "custos_municipio_mes.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    cols = [c[0] for c in con.sql(f"DESCRIBE SELECT * FROM '{silver_sia}'").fetchall()]
    has_municipio = "municipio" in cols

    municipio_expr = "municipio" if has_municipio else "cod_mun"

    con.sql(f"""
        COPY (
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
            ORDER BY competencia, cod_mun
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("gold_custos_gerado", registros=total, caminho=str(destino))
    return destino
