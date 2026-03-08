"""Testes da Iteração 2.1 — Fixes de dados e backend.

Metodologia test-first conforme AGENTS.md.
"""

import pytest
from starlette.testclient import TestClient

from backend.app import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


class TestIbgeLatLonBounds:
    """2.1.1: Coordenadas devem estar dentro dos limites do Brasil."""

    BRASIL_LAT = (-33.8, 5.3)
    BRASIL_LON = (-73.9, -34.8)

    def test_mapa_obitos_lat_lon_within_brasil(self, client):
        r = client.get("/api/dashboard/mapa?metrica=obitos")
        assert r.status_code == 200
        for d in r.json()["dados"]:
            if d["lat"] is not None and d["lon"] is not None:
                assert self.BRASIL_LAT[0] <= d["lat"] <= self.BRASIL_LAT[1], (
                    f"{d['municipio']}: lat={d['lat']} fora dos limites"
                )
                assert self.BRASIL_LON[0] <= d["lon"] <= self.BRASIL_LON[1], (
                    f"{d['municipio']}: lon={d['lon']} fora dos limites"
                )

    def test_geojson_endpoint_filtra_coordenadas_invalidas(self, client):
        r = client.get("/api/geo/municipios")
        assert r.status_code == 200
        fc = r.json()
        assert fc["type"] == "FeatureCollection"
        assert len(fc["features"]) > 0
        for f in fc["features"]:
            lon, lat = f["geometry"]["coordinates"]
            assert self.BRASIL_LAT[0] <= lat <= self.BRASIL_LAT[1]
            assert self.BRASIL_LON[0] <= lon <= self.BRASIL_LON[1]


class TestIndicadoresMunicipio:
    """2.1.2: Indicadores devem retornar valores quando disponíveis."""

    def test_indicadores_com_populacao(self, client):
        r = client.get("/api/dashboard/municipios")
        munis = r.json()["municipios"]
        assert len(munis) > 0

        cod = munis[0]["cod_mun_ibge"]
        r2 = client.get(f"/api/indicadores/municipio/{cod}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["municipio"] is not None
        assert data["uf"] is not None

    def test_ranking_retorna_resultados(self, client):
        r = client.get("/api/indicadores/ranking?ano=2023&metrica=taxa_obitos_100mil")
        assert r.status_code == 200
        ranking = r.json()["ranking"]
        assert len(ranking) > 0
        for item in ranking:
            assert item["populacao"] > 0
            assert item["taxa_obitos_100mil"] >= 0
            assert item["custo_per_capita"] >= 0


class TestGeoJsonEndpoint:
    """2.1.4: Endpoint GeoJSON válido."""

    def test_geojson_municipios_retorna_feature_collection(self, client):
        r = client.get("/api/geo/municipios")
        assert r.status_code == 200
        fc = r.json()
        assert fc["type"] == "FeatureCollection"
        assert isinstance(fc["features"], list)
        assert len(fc["features"]) > 0

    def test_geojson_feature_structure(self, client):
        r = client.get("/api/geo/municipios")
        fc = r.json()
        f = fc["features"][0]
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] == "Point"
        assert len(f["geometry"]["coordinates"]) == 2
        assert "municipio" in f["properties"]
        assert "valor" in f["properties"]
        assert "uf" in f["properties"]

    def test_geojson_custos_metrica(self, client):
        r = client.get("/api/geo/municipios?metrica=custos")
        assert r.status_code == 200
        fc = r.json()
        assert fc["type"] == "FeatureCollection"
        assert len(fc["features"]) > 0
        assert fc["features"][0]["properties"]["valor"] > 0

    def test_geojson_filtro_ano(self, client):
        r = client.get("/api/geo/municipios?ano=2023")
        assert r.status_code == 200
        fc = r.json()
        assert len(fc["features"]) > 0
