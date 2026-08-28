"""Contratos HTTP dos endpoints de fluxos residencia-ocorrencia SIM."""

import pytest

pytestmark = pytest.mark.requires_data

# Municipio de teste: Vitoria da Conquista (BA), cod 293330.
# Valores fixados nos dados silver 2024 e validados manualmente.
_COD = "293330"
_ANO = 2024


def test_fluxos_origens_retorna_estrutura_completa(client):
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SIM"
    assert payload["direcao"] == "origens"
    assert payload["municipio_alvo"]["cod_mun_ibge"] == _COD
    assert isinstance(payload["total_obitos"], int) and payload["total_obitos"] > 0
    assert isinstance(payload["total_ambos_encontrados"], int)
    assert isinstance(payload["obitos_proprio_municipio"], int)
    assert isinstance(payload["obitos_fora"], int)
    assert 0.0 <= payload["proporcao_fora"] <= 1.0
    assert isinstance(payload["municipios_conectados"], int)
    assert isinstance(payload["arestas"], list)
    assert "filtros" in payload
    assert "notas_metodologicas" in payload


def test_fluxos_origens_soma_ambos_encontrados_corresponde_aos_dados(client):
    """Ambos encontrados deve igualar proprio + fora."""
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    total_ambos = payload["total_ambos_encontrados"]
    assert total_ambos == 156  # validado manualmente na silver
    assert payload["obitos_proprio_municipio"] == 76
    assert payload["obitos_fora"] == 80
    assert payload["obitos_proprio_municipio"] + payload["obitos_fora"] == total_ambos


def test_fluxos_origens_arestas_somam_ao_total_encontrado(client):
    """Soma das arestas (sem desconhecidos) deve igualar total_ambos_encontrados."""
    response = client.get(
        "/api/sim/fluxos",
        params={
            "cod_municipio": _COD,
            "direcao": "origens",
            "ano": _ANO,
            "top_n": 200,
            "min_obitos": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    soma_arestas = sum(a["obitos"] for a in payload["arestas"])
    assert soma_arestas == payload["total_ambos_encontrados"]


def test_fluxos_origens_edge_proprio_municipio_existe(client):
    """Deve existir uma aresta onde propria_municipio=True com o codigo do alvo."""
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    arestas = response.json()["arestas"]
    proprias = [a for a in arestas if a["propria_municipio"]]
    assert len(proprias) >= 1
    assert proprias[0]["cod_mun_ibge"] == _COD


def test_fluxos_destinos_direcao_diferente_de_origens(client):
    """Destinos e origens tem totais distintos para o mesmo municipio."""
    r_origens = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    r_destinos = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "destinos", "ano": _ANO},
    )
    assert r_origens.status_code == 200
    assert r_destinos.status_code == 200
    p_o = r_origens.json()
    p_d = r_destinos.json()
    assert p_o["direcao"] == "origens"
    assert p_d["direcao"] == "destinos"
    # Origens conta quem OCORREU no municipio; destinos conta quem RESIDIA
    assert p_o["total_ambos_encontrados"] != p_d["total_ambos_encontrados"]


def test_fluxos_destinos_soma_correto(client):
    """Para destinos: proprio + fora deve igualar total_ambos_encontrados."""
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "destinos", "ano": _ANO, "top_n": 200},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_ambos_encontrados"] == 102
    assert payload["obitos_proprio_municipio"] == 76
    assert payload["obitos_fora"] == 26
    soma_arestas = sum(a["obitos"] for a in payload["arestas"])
    assert soma_arestas == payload["total_ambos_encontrados"]


def test_fluxos_municipio_invalido_retorna_422(client):
    response = client.get("/api/sim/fluxos", params={"cod_municipio": "12"})
    assert response.status_code == 422


def test_fluxos_municipio_sem_dados_retorna_404(client):
    # Codigo valido mas sem dados no filtro impossivel
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": "999999", "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 404


def test_fluxos_top_n_limita_arestas(client):
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO, "top_n": 3},
    )
    assert response.status_code == 200
    assert len(response.json()["arestas"]) <= 3


def test_fluxos_geografias_status_presentes_nas_arestas(client):
    """Cada aresta deve ter o campo geografia_status."""
    response = client.get(
        "/api/sim/fluxos",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    arestas = response.json()["arestas"]
    assert all("geografia_status" in a for a in arestas)
    # Por padrao desconhecidos sao excluidos; todas devem ser 'encontrado'
    assert all(a["geografia_status"] == "encontrado" for a in arestas)


def test_fluxos_geo_retorna_feature_collection(client):
    response = client.get(
        "/api/sim/fluxos/geo",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert isinstance(payload["features"], list)
    assert len(payload["features"]) > 0


def test_fluxos_geo_tem_propriedades_de_fluxo(client):
    """Features com has_flow=True devem ter obitos e participacao."""
    response = client.get(
        "/api/sim/fluxos/geo",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    features = response.json()["features"]
    flow_features = [f for f in features if f["properties"]["has_flow"]]
    assert len(flow_features) > 0
    for f in flow_features:
        props = f["properties"]
        assert "obitos" in props
        assert "participacao" in props
        assert "is_alvo" in props
        assert "propria_municipio" in props


def test_fluxos_geo_inclui_municipio_alvo(client):
    """O municipio alvo deve estar nas features com is_alvo=True."""
    response = client.get(
        "/api/sim/fluxos/geo",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    features = response.json()["features"]
    alvo_features = [
        f for f in features
        if f["properties"].get("is_alvo") and f["properties"]["cod_mun_ibge"][:6] == _COD
    ]
    assert len(alvo_features) >= 1


def test_fluxos_geo_inclui_contexto_uf(client):
    """Features da mesma UF do alvo devem estar presentes (contexto geografico)."""
    response = client.get(
        "/api/sim/fluxos/geo",
        params={"cod_municipio": _COD, "direcao": "origens", "ano": _ANO},
    )
    assert response.status_code == 200
    features = response.json()["features"]
    ba_features = [f for f in features if f["properties"]["uf"] == "BA"]
    # BA tem 417 municipios; pelo menos varios devem estar presentes
    assert len(ba_features) >= 50
