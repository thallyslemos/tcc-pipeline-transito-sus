"""
Módulo de carga - DuckDB e persistência Parquet.

Responsável por criar views Gold no DuckDB e exportar
Parquet para consumo pela API e dashboards.
"""

import logging
from pathlib import Path

import duckdb
import pandas as pd

from config.settings import GOLD_DIR

logger = logging.getLogger(__name__)


def carregar_gold_duckdb(
    conn: duckdb.DuckDBPyConnection,
    df_obitos: pd.DataFrame,
    df_custos: pd.DataFrame | None = None,
) -> None:
    """
    Carrega tabelas Gold no DuckDB e cria views.

    Args:
        conn: Conexão DuckDB.
        df_obitos: DataFrame Gold de óbitos.
        df_custos: DataFrame Gold de custos (opcional, SIA).
    """
    conn.execute("CREATE SCHEMA IF NOT EXISTS gold")
    conn.register("obitos_df", df_obitos)
    conn.execute(
        """
        CREATE OR REPLACE TABLE gold.v_obitos_transito AS
        SELECT * FROM obitos_df
        """
    )
    conn.unregister("obitos_df")

    if df_custos is not None and len(df_custos) > 0:
        conn.register("custos_df", df_custos)
        conn.execute(
            """
            CREATE OR REPLACE TABLE gold.v_custos_transito AS
            SELECT * FROM custos_df
            """
        )
        conn.unregister("custos_df")

    logger.info("Views Gold criadas no DuckDB")


def exportar_parquet_gold(
    df: pd.DataFrame,
    nome: str,
    output_dir: Path | None = None,
) -> Path:
    """
    Exporta DataFrame Gold para Parquet.

    Args:
        df: DataFrame Gold.
        nome: Nome do arquivo (sem extensão).
        output_dir: Diretório de saída. Default: GOLD_DIR.

    Returns:
        Path do arquivo gerado.
    """
    output_dir = output_dir or GOLD_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{nome}.parquet"
    df.to_parquet(path, index=False)
    logger.info("Exportado: %s", path)
    return path


def query_obitos_municipio(
    conn: duckdb.DuckDBPyConnection,
    cod_mun: str,
    ano: int | None = None,
) -> pd.DataFrame:
    """
    Consulta óbitos por município (e opcionalmente ano).

    Args:
        conn: Conexão DuckDB.
        cod_mun: Código IBGE 6 dígitos.
        ano: Ano para filtrar (opcional).

    Returns:
        DataFrame com resultados.
    """
    sql = """
        SELECT cod_mun_ibge, competencia, obitos, causabas
        FROM gold.v_obitos_transito
        WHERE cod_mun_ibge = ?
    """
    params = [cod_mun]
    if ano:
        sql += " AND EXTRACT(YEAR FROM competencia) = ?"
        params.append(ano)
    sql += " ORDER BY competencia"
    return conn.execute(sql, params).fetchdf()
