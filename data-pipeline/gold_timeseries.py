"""Modulo para geracao de series temporais de alta resolucao (diaria).

Gera a tabela Gold `eventos_diarios_municipio.parquet` para analise preditiva,
capturando obitos por dia de ocorrencia.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def gerar_gold_diario(silver_sim: Path, silver_sia: Path | None) -> Path:
    """Gera tabela Gold diaria agregando SIM (obitos) e opcionalmente SIA (custos).

    Quando silver_sia for None, gera apenas obitos diarios (sem custos).
    """
    if not silver_sim.exists():
        msg = f"Silver SIM nao encontrado: {silver_sim}"
        raise FileNotFoundError(msg)

    destino = settings.resolve(settings.gold_dir) / "eventos_diarios_municipio.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    # Agregacao SIM por dia
    con.sql(f"""
        CREATE TABLE obitos_diarios AS
        SELECT
            cod_mun_ocorrencia AS cod_mun_ibge,
            uf,
            dt_obito AS data,
            COUNT(*) AS total_obitos
        FROM read_parquet('{silver_sim}')
        GROUP BY cod_mun_ocorrencia, uf, dt_obito
    """)

    if silver_sia and silver_sia.exists():
        # Agregacao SIA por mes (ja que nao temos dia confiavel para custos)
        con.sql(f"""
            CREATE TABLE custos_mensais AS
            SELECT
                cod_mun AS cod_mun_ibge,
                competencia AS data,
                SUM(valor_aprovado) AS custo_total
            FROM read_parquet('{silver_sia}')
            GROUP BY cod_mun, competencia
        """)

        # Join das duas tabelas. Usamos FULL OUTER JOIN para nao perder dias
        # que so tem obitos ou meses que so tem custos (improvavel mas possivel).
        con.sql(f"""
            COPY (
                SELECT
                    COALESCE(o.cod_mun_ibge, c.cod_mun_ibge) AS cod_mun_ibge,
                    COALESCE(o.data, c.data) AS data,
                    COALESCE(o.total_obitos, 0) AS total_obitos,
                    COALESCE(c.custo_total, 0) AS custo_total
                FROM obitos_diarios o
                FULL OUTER JOIN custos_mensais c
                    ON o.cod_mun_ibge = c.cod_mun_ibge AND o.data = c.data
                ORDER BY data, cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)
    else:
        # Modo SIM-only: apenas obitos diarios, custos zerados
        con.sql(f"""
            COPY (
                SELECT
                    cod_mun_ibge,
                    data,
                    total_obitos,
                    0 AS custo_total
                FROM obitos_diarios
                ORDER BY data, cod_mun_ibge
            ) TO '{destino}' (FORMAT PARQUET)
        """)

    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("gold_diario_gerado", registros=total, caminho=str(destino))
    return destino
