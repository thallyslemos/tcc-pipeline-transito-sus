# ruff: noqa: E501
from importlib import import_module
from pathlib import Path

import duckdb

ibge = import_module("data-pipeline.ibge_fetcher")


def test_centroide_url_usa_codigo(monkeypatch):
    seen = []

    class Response:
        def json(self):
            return [{"centroide": {"latitude": -10.0, "longitude": -40.0}}]

    def fake(url, **kwargs):
        seen.append(url)
        return Response()

    monkeypatch.setattr(ibge, "_http_get_with_retry", fake)
    cod, coords = ibge.fetch_centroide_municipio("2927401")
    assert cod == "2927401"
    assert coords == {"lat": -10.0, "lon": -40.0}
    assert seen == [
        "https://servicodados.ibge.gov.br/api/v4/malhas/municipios/2927401/metadados"
    ]


def test_infer_nao_le_sia(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(type(ibge.settings), "resolve", lambda _self, value: tmp_path / value)
    silver = tmp_path / "data" / "silver"
    silver.mkdir(parents=True)
    con = duckdb.connect(":memory:")
    con.sql("CREATE TABLE sim AS SELECT * FROM (VALUES ('292740', DATE '2024-01-01', 'BA')) t(cod_mun_ocorrencia, competencia, uf)")
    con.sql(f"COPY sim TO '{silver / 'sim.parquet'}' (FORMAT PARQUET)")
    con.close()
    assert ibge._infer_cod_ano_uf() == [("292740", 2024, "BA")]
