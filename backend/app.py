"""Minimal FastAPI backend demonstrating DuckDB integration with sample data."""

from contextlib import asynccontextmanager

import duckdb
from fastapi import FastAPI

DB: duckdb.DuckDBPyConnection | None = None


def _seed_sample_data(con: duckdb.DuckDBPyConnection) -> None:
    con.sql("""
        CREATE TABLE IF NOT EXISTS obitos_transito (
            cod_mun_ibge VARCHAR,
            municipio    VARCHAR,
            competencia  DATE,
            obitos       INTEGER,
            causabas     VARCHAR
        )
    """)
    con.sql("""
        INSERT INTO obitos_transito VALUES
        ('2933307', 'Vitória da Conquista', '2023-01-01', 5, 'V201'),
        ('2933307', 'Vitória da Conquista', '2023-02-01', 3, 'V291'),
        ('3550308', 'São Paulo',            '2023-01-01', 42, 'V031'),
        ('3550308', 'São Paulo',            '2023-02-01', 38, 'V491'),
        ('3106200', 'Belo Horizonte',       '2023-01-01', 18, 'V201'),
        ('3106200', 'Belo Horizonte',       '2023-02-01', 15, 'V401')
    """)
    con.sql("""
        CREATE VIEW IF NOT EXISTS v_obitos_transito_municipio_mes AS
        SELECT
            cod_mun_ibge,
            municipio,
            competencia,
            SUM(obitos) AS total_obitos
        FROM obitos_transito
        WHERE LEFT(causabas, 3) BETWEEN 'V01' AND 'V89'
        GROUP BY cod_mun_ibge, municipio, competencia
        ORDER BY competencia, municipio
    """)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global DB
    DB = duckdb.connect(":memory:")
    _seed_sample_data(DB)
    yield
    if DB:
        DB.close()


app = FastAPI(
    title="Pipeline Acidentes de Trânsito no SUS",
    description="MVP — API de consulta de óbitos por acidentes de trânsito",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return {"status": "ok", "message": "Pipeline Analítico de Acidentes de Trânsito no SUS"}


@app.get("/obitos")
async def obitos_por_municipio(municipio: str | None = None):
    query = "SELECT * FROM v_obitos_transito_municipio_mes"
    if municipio:
        query += f" WHERE municipio ILIKE '%{municipio}%'"
    return DB.sql(query).fetchdf().to_dict(orient="records")


@app.get("/obitos/total")
async def total_obitos():
    result = DB.sql("SELECT SUM(total_obitos) AS total FROM v_obitos_transito_municipio_mes").fetchone()
    return {"total_obitos": result[0]}
