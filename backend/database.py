"""Gerenciador de conexão DuckDB para leitura dos Parquet Gold.

Mantém uma conexão singleton (DuckDB é single-writer)
que registra views sobre os arquivos Parquet gerados pelo pipeline.
"""

from pathlib import Path

import duckdb
import structlog

from .config import settings

logger = structlog.get_logger(__name__)

_connection: duckdb.DuckDBPyConnection | None = None


def _gold_path(filename: str) -> str:
    return str(settings.resolve(settings.gold_dir) / filename)


def _data_path(filename: str) -> str:
    return str(settings.project_root / "data" / filename)


def get_connection() -> duckdb.DuckDBPyConnection:
    """Retorna a conexão DuckDB singleton, criando se necessário."""
    global _connection
    if _connection is None:
        _connection = _init_connection()
    return _connection


def _init_connection() -> duckdb.DuckDBPyConnection:
    """Inicializa DuckDB in-memory com views sobre os Parquet Gold."""
    con = duckdb.connect(":memory:")

    gold_dir = Path(settings.resolve(settings.gold_dir))
    custos_path = _gold_path("custos_municipio_mes.parquet")

    ocorrencia_path = gold_dir / "obitos_ocorrencia_municipio_mes.parquet"
    residencia_path = gold_dir / "obitos_residencia_municipio_mes.parquet"
    obitos_legacy_path = gold_dir / "obitos_municipio_mes.parquet"

    if ocorrencia_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_obitos_ocorrencia AS
            SELECT * FROM read_parquet('{ocorrencia_path}')
        """)
        con.sql("CREATE OR REPLACE VIEW v_obitos AS SELECT * FROM v_obitos_ocorrencia")
    elif obitos_legacy_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_obitos AS
            SELECT * FROM read_parquet('{obitos_legacy_path}')
        """)
    else:
        raise FileNotFoundError(
            f"Parquet Gold de óbitos não encontrado. Esperado: {ocorrencia_path} ou {obitos_legacy_path}"
        )

    if residencia_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_obitos_residencia AS
            SELECT * FROM read_parquet('{residencia_path}')
        """)
    con.sql(f"""
        CREATE VIEW IF NOT EXISTS v_custos AS
        SELECT * FROM read_parquet('{custos_path}')
    """)

    ibge_mun_path = _data_path("ibge_municipios.parquet")
    ibge_pop_path = _data_path("ibge_populacao.parquet")
    if Path(ibge_mun_path).exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_ibge_municipios AS
            SELECT * FROM read_parquet('{ibge_mun_path}')
        """)
    if Path(ibge_pop_path).exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_ibge_populacao AS
            SELECT * FROM read_parquet('{ibge_pop_path}')
        """)

    logger.info(
        "duckdb_inicializado",
        obitos_ocorrencia=str(ocorrencia_path),
        obitos_residencia=str(residencia_path),
        custos=custos_path,
    )
    return con


def close_connection() -> None:
    """Fecha a conexão DuckDB."""
    global _connection
    if _connection:
        _connection.close()
        _connection = None
        logger.info("duckdb_fechado")
