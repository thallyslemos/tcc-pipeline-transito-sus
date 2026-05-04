"""Arquivo de configuração do Pytest (fixtures compartilhadas)."""

import unicodedata

import pytest
from backend.app import app
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    """
    Fixture que fornece um TestClient para a aplicação FastAPI.
    O escopo é de sessão para evitar recriar o cliente para cada teste.
    """
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def ano_disponivel(client: TestClient) -> int:
    """Obtém o primeiro ano disponível nos dados para usar nos testes."""
    r = client.get("/api/dashboard/anos")
    r.raise_for_status()
    anos = r.json()["anos"]
    assert len(anos) > 0, "A API de anos não retornou nenhum ano disponível."
    return anos[0]


@pytest.fixture(scope="session")
def municipio_disponivel(client: TestClient) -> dict:
    """Obtém o primeiro município disponível para usar nos testes."""
    r = client.get("/api/dashboard/municipios")
    r.raise_for_status()
    municipios = r.json()["municipios"]
    assert len(municipios) > 0, "A API de municípios não retornou nenhum município."
    return {
        "cod_mun_ibge": municipios[0]["cod_mun_ibge"],
        "nome": municipios[0]["municipio"],
    }


def normalize_str(s: str) -> str:
    """Normaliza string, removendo acentos e convertendo para minúsculas."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    ).lower()
