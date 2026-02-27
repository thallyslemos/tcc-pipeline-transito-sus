"""Smoke tests to verify the core stack works."""

import duckdb
import pandas as pd
import pyarrow as pa


def test_duckdb_query():
    con = duckdb.connect(":memory:")
    result = con.sql("SELECT 1 + 1 AS soma").fetchone()
    assert result == (2,)


def test_duckdb_cid_filter():
    con = duckdb.connect(":memory:")
    con.sql("""
        CREATE TABLE sim_sample AS
        SELECT * FROM (VALUES
            ('V201', 2933307, '2023-01-15'),
            ('V891', 3550308, '2023-02-10'),
            ('X100', 2927408, '2023-03-20'),
            ('V011', 2933307, '2023-04-05')
        ) AS t(causabas, codmunocor, dtobito)
    """)
    result = con.sql("""
        SELECT COUNT(*) AS total
        FROM sim_sample
        WHERE LEFT(causabas, 3) BETWEEN 'V01' AND 'V89'
    """).fetchone()
    assert result == (3,)


def test_parquet_roundtrip(tmp_path):
    df = pd.DataFrame(
        {
            "cod_mun_ibge": ["2933307", "3550308"],
            "competencia": pd.to_datetime(["2023-01-01", "2023-02-01"]),
            "obitos": [5, 12],
        }
    )
    path = tmp_path / "test_obitos.parquet"
    df.to_parquet(path, engine="pyarrow")

    con = duckdb.connect(":memory:")
    result = con.sql(f"SELECT SUM(obitos) FROM '{path}'").fetchone()
    assert result == (17,)


def test_pyarrow_table():
    table = pa.table({"custo_total": [1500.50, 2300.75], "procedimentos": [10, 15]})
    assert table.num_rows == 2
    assert table.column_names == ["custo_total", "procedimentos"]
