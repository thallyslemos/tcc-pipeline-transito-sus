"""
API FastAPI para o sistema de apoio à decisão.

Expõe endpoints REST para consumo pelos dashboards.
Dados servidos a partir do DuckDB/Parquet Gold.
"""

import logging

import duckdb
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from config.logging_config import setup_logging
from config.settings import GOLD_DIR, PROJECT_ROOT

setup_logging(level="INFO", log_file=True)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Pipeline Acidentes Trânsito SUS",
    description="API para dashboards de apoio à decisão",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexão DuckDB em memória, carregada sob demanda
_conn: duckdb.DuckDBPyConnection | None = None


def get_conn() -> duckdb.DuckDBPyConnection:
    """Obtém conexão DuckDB com dados Gold carregados."""
    global _conn
    if _conn is None:
        _conn = duckdb.connect(":memory:")
        gold_path = GOLD_DIR / "v_obitos_transito.parquet"
        if gold_path.exists():
            _conn.execute("CREATE SCHEMA IF NOT EXISTS gold")
            _conn.execute(
                """
                CREATE OR REPLACE TABLE gold.v_obitos_transito AS
                SELECT * FROM read_parquet(?)
                """,
                [str(gold_path)],
            )
        else:
            logger.warning("Arquivo Gold não encontrado. Execute o pipeline EDA primeiro.")
    return _conn


@app.get("/")
async def root():
    """Serve o dashboard ou status da API."""
    html_path = PROJECT_ROOT / "frontend" / "index.html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    return {"status": "ok", "docs": "/docs"}


@app.get("/api/obitos/serie", response_model=dict)
async def obitos_serie_temporal(
    ano: int | None = Query(None, description="Filtrar por ano"),
):
    """Retorna série temporal de óbitos por competência."""
    conn = get_conn()
    sql = """
        SELECT competencia, SUM(obitos) as total
        FROM gold.v_obitos_transito
    """
    params = []
    if ano:
        sql += " WHERE EXTRACT(YEAR FROM competencia) = ?"
        params.append(ano)
    sql += " GROUP BY competencia ORDER BY competencia"
    df = conn.execute(sql, params).fetchdf()
    df["competencia"] = df["competencia"].astype(str)
    return {"labels": df["competencia"].tolist(), "values": df["total"].tolist()}


@app.get("/api/obitos/municipios", response_model=dict)
async def obitos_por_municipio(limite: int = Query(10, ge=1, le=50)):
    """Retorna top municípios por total de óbitos."""
    conn = get_conn()
    df = conn.execute(
        """
        SELECT cod_mun_ibge, SUM(obitos) as total
        FROM gold.v_obitos_transito
        GROUP BY cod_mun_ibge
        ORDER BY total DESC
        LIMIT ?
        """,
        [limite],
    ).fetchdf()
    return {
        "labels": df["cod_mun_ibge"].astype(str).tolist(),
        "values": df["total"].tolist(),
    }


@app.get("/api/obitos/municipio/{cod_mun}", response_model=dict)
async def obitos_municipio(
    cod_mun: str,
    ano: int | None = Query(None),
):
    """Retorna óbitos de um município específico."""
    conn = get_conn()
    sql = "SELECT competencia, obitos FROM gold.v_obitos_transito WHERE cod_mun_ibge = ?"
    params = [cod_mun]
    if ano:
        sql += " AND EXTRACT(YEAR FROM competencia) = ?"
        params.append(ano)
    sql += " ORDER BY competencia"
    df = conn.execute(sql, params).fetchdf()
    df["competencia"] = df["competencia"].astype(str)
    return {"labels": df["competencia"].tolist(), "values": df["obitos"].tolist()}


