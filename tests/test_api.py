"""Testes da API FastAPI (endpoints do dashboard e indicadores)."""

import pytest
from backend.app import app
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_summary(client):
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0
    assert d["total_custos"] > 0
    assert d["total_atendimentos"] > 0
    assert d["municipios"] == 9
    assert len(d["obitos_por_ano"]) > 0
    assert len(d["serie_temporal_obitos"]) > 0


def test_dashboard_summary_by_year(client):
    r = client.get("/api/dashboard/summary?ano=2023")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0
    assert "2023" in d["periodo"]


def test_dashboard_summary_with_filters(client):
    r = client.get("/api/dashboard/summary?ano=2023&municipio=3550308")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0
    assert d["municipios"] == 1


def test_anos_disponiveis(client):
    r = client.get("/api/dashboard/anos")
    assert r.status_code == 200
    assert 2023 in r.json()["anos"]


def test_tipos_veiculo(client):
    r = client.get("/api/dashboard/tipos-veiculo")
    assert r.status_code == 200
    assert len(r.json()["tipos"]) > 0


def test_listar_municipios(client):
    r = client.get("/api/dashboard/municipios")
    assert r.status_code == 200
    munis = r.json()["municipios"]
    assert len(munis) == 9
    assert all("lat" in m for m in munis)


def test_municipio_detalhe(client):
    r = client.get("/api/dashboard/municipio/3550308")
    assert r.status_code == 200
    d = r.json()
    assert d["municipio"] == "Sao Paulo"
    assert d["total_obitos"] > 0
    assert len(d["serie_obitos"]) > 0
    assert len(d["obitos_por_tipo_veiculo"]) > 0


def test_mapa_obitos(client):
    r = client.get("/api/dashboard/mapa?metrica=obitos")
    assert r.status_code == 200
    d = r.json()
    assert d["metrica"] == "obitos"
    assert len(d["dados"]) == 9


def test_mapa_custos(client):
    r = client.get("/api/dashboard/mapa?metrica=custos&ano=2023")
    assert r.status_code == 200
    d = r.json()
    assert d["metrica"] == "custos"
    assert d["ano"] == 2023


def test_indicadores_municipio(client):
    r = client.get("/api/indicadores/municipio/3550308")
    assert r.status_code == 200
    d = r.json()
    assert d["municipio"] == "Sao Paulo"
    assert d.get("idh") is None or d["idh"] > 0
    assert len(d["indicadores"]) >= 1
    ind = d["indicadores"][0]
    assert ind["taxa_obitos_100mil"] >= 0
    assert ind["custo_per_capita"] >= 0
    assert ind["populacao"] > 0
    assert "fontes" in d


def test_indicadores_municipio_by_year(client):
    r = client.get("/api/indicadores/municipio/2933307?ano=2023")
    assert r.status_code == 200
    d = r.json()
    assert len(d["indicadores"]) == 1
    assert d["indicadores"][0]["ano"] == 2023


def test_ranking(client):
    r = client.get("/api/indicadores/ranking?ano=2023&metrica=taxa_obitos_100mil")
    assert r.status_code == 200
    d = r.json()
    assert len(d["ranking"]) == 9
    assert d["ranking"][0]["taxa_obitos_100mil"] >= d["ranking"][-1]["taxa_obitos_100mil"]


def test_cors_headers(client):
    r = client.options(
        "/api/dashboard/summary",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
