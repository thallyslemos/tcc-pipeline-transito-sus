"""Testes da API FastAPI (endpoints do dashboard)."""

import pytest
from backend.app import app
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    """Client de teste do FastAPI."""
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    """GET / deve retornar status ok."""
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_dashboard_summary(client):
    """GET /api/dashboard/summary deve retornar dados completos."""
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["total_obitos"] > 0
    assert data["total_custos"] > 0
    assert data["total_atendimentos"] > 0
    assert data["municipios"] == 3
    assert len(data["obitos_por_ano"]) > 0
    assert len(data["serie_temporal_obitos"]) > 0
    assert len(data["obitos_por_tipo_veiculo"]) > 0
    assert len(data["obitos_por_faixa_etaria"]) > 0


def test_dashboard_summary_by_year(client):
    """GET /api/dashboard/summary?ano=2023 deve filtrar por ano."""
    r = client.get("/api/dashboard/summary?ano=2023")
    assert r.status_code == 200
    data = r.json()
    assert data["total_obitos"] > 0
    assert data["periodo"] == "Ano 2023"


def test_anos_disponiveis(client):
    """GET /api/dashboard/anos deve listar anos disponíveis."""
    r = client.get("/api/dashboard/anos")
    assert r.status_code == 200
    data = r.json()
    assert "anos" in data
    assert 2023 in data["anos"]
    assert 2019 in data["anos"]


def test_municipio_detalhe(client):
    """GET /api/dashboard/municipio/{cod_mun} deve retornar dados."""
    r = client.get("/api/dashboard/municipio/3550308")
    assert r.status_code == 200
    data = r.json()
    assert data["municipio"] == "São Paulo"
    assert len(data["serie_obitos"]) > 0
    assert len(data["serie_custos"]) > 0


def test_cors_headers(client):
    """Resposta deve incluir headers CORS para localhost:3000."""
    r = client.options(
        "/api/dashboard/summary",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
