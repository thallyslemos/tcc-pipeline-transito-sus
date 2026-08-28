"""Contrato de agregados DuckDB (Parquet) vs PostgreSQL após carga."""

from __future__ import annotations

import importlib
import os

import duckdb
import psycopg
import pytest
from db.run_migrations import apply_migrations


@pytest.mark.integration
def test_soma_obitos_ocorrencia_parquet_igual_postgres() -> None:
    """Compara SUM(total_obitos) entre read_parquet e a tabela gold carregada."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Defina TEST_DATABASE_URL para testar integração PostgreSQL")

    from backend.config import settings

    gold = settings.resolve(settings.gold_dir) / "obitos_ocorrencia_municipio_mes.parquet"
    legacy = settings.resolve(settings.gold_dir) / "obitos_municipio_mes.parquet"
    path = gold if gold.exists() else legacy
    if not path.exists():
        pytest.skip("Parquet Gold de óbitos (ocorrência) ausente")

    apply_migrations(url, schema="public")
    pl = importlib.import_module("data-pipeline.postgres_load")
    pl.load_gold_to_postgres(dsn=url, schema="public")

    con = duckdb.connect(":memory:")
    duck_sum = con.sql(f"SELECT COALESCE(SUM(total_obitos), 0) FROM '{path}'").fetchone()[0]
    con.close()

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(total_obitos), 0) FROM public.gold_obitos_ocorrencia")
        pg_sum = cur.fetchone()[0]

    assert int(duck_sum) == int(pg_sum)
