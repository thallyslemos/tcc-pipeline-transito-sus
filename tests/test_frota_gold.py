"""Testes do ETL Gold de frota (CSV SENATRAN normalizado)."""

from importlib import import_module

import duckdb


def test_build_frota_municipio_ano_agrega_linhas(tmp_path):
    frota_mod = import_module("data-pipeline.frota_gold")
    csv = tmp_path / "frota_in.csv"
    csv.write_text(
        "cod_mun_ibge,ano,quantidade\n2933307,2024,1000\n2933307,2024,500\n",
        encoding="utf-8",
    )
    out = tmp_path / frota_mod.GOLD_FILENAME
    p = frota_mod.build_frota_municipio_ano(bronze_csv=csv, dest=out)
    assert p == out
    assert out.exists()
    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM read_parquet('{out}') ORDER BY ano").fetchdf()
    assert len(df) == 1
    assert int(df.iloc[0]["frota_total"]) == 1500
    assert str(df.iloc[0]["cod_mun_ibge"]) == "293330"
    assert int(df.iloc[0]["ano"]) == 2024


def test_build_frota_municipio_ano_sem_arquivo_retorna_none(tmp_path):
    frota_mod = import_module("data-pipeline.frota_gold")
    missing = tmp_path / "nao_existe.csv"
    assert frota_mod.build_frota_municipio_ano(bronze_csv=missing) is None
