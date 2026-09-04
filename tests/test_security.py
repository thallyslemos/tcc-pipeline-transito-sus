"""Testes de segurança: validação de entrada, flags de produção e headers."""

import pytest
from backend.config import Settings
from backend.middleware_security import validate_production_settings
from backend.routers.utils import cod6_seguro, texto_busca_seguro, uf_seguro
from fastapi.testclient import TestClient


def test_cod6_rejeita_injection():
    assert cod6_seguro("293330") == "293330"
    assert cod6_seguro("29333' OR 1=1--") is None
    assert cod6_seguro("abc") is None


def test_uf_seguro():
    assert uf_seguro("ba") == "BA"
    assert uf_seguro("XX") is None
    assert uf_seguro("BA'; DROP--") is None


def test_texto_busca_remove_wildcards():
    assert texto_busca_seguro("Salvador") == "Salvador"
    assert texto_busca_seguro("%'; DROP TABLE--") == "DROP TABLE--"


def test_validate_production_cors_obrigatorio():
    cfg = Settings(app_env="production", cors_origins="")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        validate_production_settings(cfg)


def test_validate_production_rejeita_localhost():
    cfg = Settings(app_env="production", cors_origins="http://localhost:3000")
    with pytest.raises(RuntimeError, match="invalido"):
        validate_production_settings(cfg)


def test_validate_production_aceita_vercel():
    cfg = Settings(
        app_env="production",
        cors_origins="https://tcc-pipeline-transito-sus.vercel.app",
    )
    validate_production_settings(cfg)


def test_health_expoe_flags_seguranca(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    sec = r.json().get("security")
    assert sec is not None
    assert "mcp_bridge" in sec
    assert "predict" in sec


def test_security_headers(client: TestClient):
    r = client.get("/")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"


@pytest.mark.requires_data
def test_dashboard_municipio_injection_retorna_422(client: TestClient):
    r = client.get("/api/dashboard/municipio/29333'%20OR%201=1--")
    assert r.status_code == 422


def test_predict_404_when_disabled(client: TestClient, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "predict_enabled", False)
    r = client.get("/api/predict/obitos/293330")
    assert r.status_code == 404
