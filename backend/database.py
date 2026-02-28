"""Gerenciador de conexão DuckDB para leitura dos Parquet Gold.

Mantém uma conexão singleton (DuckDB é single-writer)
que registra views sobre os arquivos Parquet gerados pelo pipeline.
"""

import duckdb
import structlog

from .config import settings

logger = structlog.get_logger(__name__)

_connection: duckdb.DuckDBPyConnection | None = None


def _gold_path(filename: str) -> str:
    return str(settings.resolve(settings.gold_dir) / filename)


def get_connection() -> duckdb.DuckDBPyConnection:
    """Retorna a conexão DuckDB singleton, criando se necessário."""
    global _connection
    if _connection is None:
        _connection = _init_connection()
    return _connection


def _init_connection() -> duckdb.DuckDBPyConnection:
    """Inicializa DuckDB in-memory com views sobre os Parquet Gold."""
    con = duckdb.connect(":memory:")

    obitos_path = _gold_path("obitos_municipio_mes.parquet")
    custos_path = _gold_path("custos_municipio_mes.parquet")

    con.sql(f"""
        CREATE VIEW IF NOT EXISTS v_obitos AS
        SELECT * FROM read_parquet('{obitos_path}')
    """)
    con.sql(f"""
        CREATE VIEW IF NOT EXISTS v_custos AS
        SELECT * FROM read_parquet('{custos_path}')
    """)

    logger.info("duckdb_inicializado", obitos=obitos_path, custos=custos_path)
    return con


def close_connection() -> None:
    """Fecha a conexão DuckDB."""
    global _connection
    if _connection:
        _connection.close()
        _connection = None
        logger.info("duckdb_fechado")
