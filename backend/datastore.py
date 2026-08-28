"""Conexão analítica: DuckDB + Parquet (local) ou PostgreSQL (produção)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
import psycopg
import structlog
from psycopg.sql import SQL, Identifier

from .config import settings

logger = structlog.get_logger(__name__)

_duck: duckdb.DuckDBPyConnection | None = None
_pg: psycopg.Connection | None = None


def _gold_path(filename: str) -> str:
    return str(settings.resolve(settings.gold_dir) / filename)


def _data_path(filename: str) -> str:
    return str(settings.project_root / "data" / filename)


def _analytics_postgres() -> bool:
    return bool(settings.use_postgres and settings.database_url)


class _PgSqlResult:
    def __init__(self, conn: psycopg.Connection, query: str) -> None:
        self._conn = conn
        self._query = query

    def fetchone(self) -> Any:
        with self._conn.cursor() as cur:
            cur.execute(self._query)
            return cur.fetchone()

    def fetchall(self) -> list[Any]:
        with self._conn.cursor() as cur:
            cur.execute(self._query)
            return cur.fetchall()

    def fetchdf(self) -> pd.DataFrame:
        """Lê resultado via cursor psycopg (sem pandas.read_sql para evitar warnings)."""
        with self._conn.cursor() as cur:
            cur.execute(self._query)
            if cur.description is None:
                return pd.DataFrame()
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            return pd.DataFrame(rows, columns=cols)

    def df(self) -> pd.DataFrame:
        return self.fetchdf()


class _PgExecResult:
    def __init__(self, conn: psycopg.Connection, query: str, params: list[Any]) -> None:
        self._conn = conn
        self._query = query
        self._params = params

    def fetchone(self) -> Any:
        with self._conn.cursor() as cur:
            cur.execute(self._query, self._params)
            return cur.fetchone()

    def fetchall(self) -> list[Any]:
        with self._conn.cursor() as cur:
            cur.execute(self._query, self._params)
            return cur.fetchall()

    def fetchdf(self) -> pd.DataFrame:
        with self._conn.cursor() as cur:
            cur.execute(self._query, self._params)
            if cur.description is None:
                return pd.DataFrame()
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            return pd.DataFrame(rows, columns=cols)

    def df(self) -> pd.DataFrame:
        return self.fetchdf()


class PgAnalyticsConnection:
    """Compatibilidade mínima com duckdb.DuckDBPyConnection (.sql / .execute)."""

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def sql(self, query: str) -> _PgSqlResult:
        return _PgSqlResult(self._conn, query)

    def execute(self, query: str, parameters: list[Any] | None = None) -> _PgExecResult:
        params = parameters or []
        q = query.replace("?", "%s")
        return _PgExecResult(self._conn, q, params)

    def has_relation(self, name: str) -> bool:
        n = name.lower()
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.views
                    WHERE table_schema = ANY (current_schemas(true))
                      AND table_name = %s
                )
                """,
                (n,),
            )
            row = cur.fetchone()
            return bool(row and row[0])


def _init_duckdb() -> duckdb.DuckDBPyConnection:
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
        msg = (
            "Parquet Gold de óbitos não encontrado. Esperado: "
            f"{ocorrencia_path} ou {obitos_legacy_path}"
        )
        raise FileNotFoundError(msg)

    if residencia_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_obitos_residencia AS
            SELECT * FROM read_parquet('{residencia_path}')
        """)
    if Path(custos_path).exists():
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

    eventos_path = gold_dir / "eventos_diarios_municipio.parquet"
    if eventos_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_eventos_diarios AS
            SELECT * FROM read_parquet('{eventos_path}')
        """)

    frota_path = gold_dir / "frota_municipio_ano.parquet"
    if frota_path.exists():
        con.sql(f"""
            CREATE VIEW IF NOT EXISTS v_frota_municipio_ano AS
            SELECT * FROM read_parquet('{frota_path}')
        """)

    logger.info(
        "duckdb_inicializado",
        obitos_ocorrencia=str(ocorrencia_path),
        obitos_residencia=str(residencia_path),
        custos=custos_path,
    )
    return con


def _init_postgres() -> PgAnalyticsConnection:
    global _pg
    if _pg is None:
        if not settings.database_url:
            msg = "database_url ausente com use_postgres=true"
            raise ValueError(msg)
        _pg = psycopg.connect(settings.database_url, autocommit=True)
        schema = Identifier(settings.postgres_schema)
        with _pg.cursor() as cur:
            cur.execute(SQL("SET search_path TO {}, public").format(schema))
        logger.info(
            "postgres_analytics_inicializado",
            schema=settings.postgres_schema,
        )
    return PgAnalyticsConnection(_pg)


def get_connection() -> duckdb.DuckDBPyConnection | PgAnalyticsConnection:
    """Singleton: DuckDB in-memory ou conexão PostgreSQL."""
    global _duck
    if _analytics_postgres():
        return _init_postgres()
    if _duck is None:
        _duck = _init_duckdb()
    return _duck


def close_connection() -> None:
    """Encerra DuckDB e/ou PostgreSQL."""
    global _duck, _pg
    if _duck:
        _duck.close()
        _duck = None
        logger.info("duckdb_fechado")
    if _pg:
        _pg.close()
        _pg = None
        logger.info("postgres_fechado")
