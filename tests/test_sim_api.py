"""Contratos HTTP do serving SIM-only."""

import re

import pytest

pytestmark = pytest.mark.requires_data


def _sum_breakdown(items: list[dict], key: str) -> int:
    return sum(int(row["total"]) for row in items)


def test_sim_summary_is_sim_only(client):
    response = client.get("/api/sim/summary", params={"dimensao": "ocorrencia"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SIM"
    assert payload["total_obitos"] == 565383
    assert "total_custos" not in payload
    assert payload["denominadores"]["frota"].startswith("informe ano")


def test_sim_summary_sem_filtro_de_ano_soma_todos_os_anos(client):
    """Regressao: 'Todos' no filtro Ano nao pode se comportar como um ano fixo.

    O bug historico era no frontend (useEffect reescrevia o ano automaticamente
    ao selecionar 'Todos'), mas o contrato do backend e o que garante a
    correcao: ausencia do parametro `ano` na query string deve somar o
    periodo inteiro, nunca um unico ano.
    """
    ba_sem_ano = client.get("/api/sim/summary", params={"dimensao": "ocorrencia", "uf": "BA"})
    assert ba_sem_ano.status_code == 200
    payload_sem_ano = ba_sem_ano.json()
    assert payload_sem_ano["total_obitos"] == 37906
    assert payload_sem_ano["periodo"] == "2010-2024"

    ba_2024 = client.get(
        "/api/sim/summary", params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2024}
    )
    assert ba_2024.status_code == 200
    payload_2024 = ba_2024.json()
    assert payload_2024["total_obitos"] == 3105
    assert payload_2024["periodo"] == "2024-2024"

    brasil_sem_ano = client.get("/api/sim/summary", params={"dimensao": "ocorrencia"})
    assert brasil_sem_ano.status_code == 200
    payload_brasil = brasil_sem_ano.json()
    assert payload_brasil["total_obitos"] == 565383
    # Nao pode ser igual ao total de nenhum ano isolado da serie.
    valores_por_ano = {row["total"] for row in payload_brasil["obitos_por_ano"]}
    assert payload_brasil["total_obitos"] not in valores_por_ano


def test_populacao_fallback_taxas_2024_nao_regridem(client):
    """As taxas de 2024 tem populacao exata e nao podem mudar com o fallback."""
    esperado = {
        "Gavião": 445.1,
        "Vitória da Conquista": 39.6,
        "Salvador": 8.2,
        "Feira de Santana": 34.5,
    }
    response = client.get(
        "/api/sim/municipios",
        params={"dimensao": "ocorrencia", "ano": 2024, "uf": "BA", "page_size": 200},
    )
    assert response.status_code == 200
    rows = {row["municipio"]: row for row in response.json()["municipios"]}
    for nome, taxa in esperado.items():
        assert round(rows[nome]["taxa_obitos_100mil"], 1) == taxa
        assert rows[nome]["populacao_origem"] == "exata"
        assert rows[nome]["populacao_defasagem_anos"] == 0
        assert rows[nome]["populacao_ano_referencia"] == 2024


def test_populacao_fallback_municipio_detalhe_usa_ano_mais_proximo(client):
    """Vitoria da Conquista (293330) nao tem populacao exata em 2022 nem 2023."""
    r_2022 = client.get(
        "/api/sim/municipio/293330", params={"dimensao": "ocorrencia", "ano": 2022}
    )
    assert r_2022.status_code == 200
    d_2022 = r_2022.json()
    assert d_2022["populacao_origem"] == "estimada"
    assert d_2022["populacao_ano_referencia"] == 2021
    assert d_2022["populacao_defasagem_anos"] == 1
    assert d_2022["populacao"] == 343643
    assert d_2022["taxa_obitos_100mil"] is not None

    r_2024 = client.get(
        "/api/sim/municipio/293330", params={"dimensao": "ocorrencia", "ano": 2024}
    )
    d_2024 = r_2024.json()
    assert d_2024["populacao_origem"] == "exata"
    assert d_2024["populacao_defasagem_anos"] == 0


def test_populacao_fallback_geo_expoe_origem_no_tooltip(client):
    """O GeoJSON do mapa expoe populacao_origem para o tooltip do frontend."""
    response = client.get(
        "/api/sim/geo", params={"dimensao": "ocorrencia", "ano": 2022, "uf": "BA"}
    )
    assert response.status_code == 200
    features = response.json()["features"]
    vc = next(f for f in features if f["properties"]["cod_mun_ibge"].startswith("293330"))
    assert vc["properties"]["populacao_origem"] == "estimada"
    assert vc["properties"]["populacao_ano_referencia"] == 2021
    assert vc["properties"]["populacao_defasagem_anos"] == 1


def test_sim_summary_exposes_global_breakdowns(client):
    response = client.get(
        "/api/sim/summary",
        params={"dimensao": "ocorrencia", "ano": 2024},
    )
    assert response.status_code == 200
    payload = response.json()
    total = int(payload["total_obitos"])
    assert total > 0

    for field in (
        "obitos_por_mes",
        "obitos_por_tipo_veiculo",
        "obitos_por_faixa_etaria",
        "obitos_por_sexo",
    ):
        assert field in payload
        assert isinstance(payload[field], list)
        assert len(payload[field]) > 0

    assert _sum_breakdown(payload["obitos_por_mes"], "total") == total
    assert _sum_breakdown(payload["obitos_por_tipo_veiculo"], "total") == total
    assert _sum_breakdown(payload["obitos_por_faixa_etaria"], "total") == total
    assert _sum_breakdown(payload["obitos_por_sexo"], "total") == total

    competencias = [row["competencia"] for row in payload["obitos_por_mes"]]
    assert all(re.fullmatch(r"\d{4}-\d{2}", value) for value in competencias)
    assert competencias == sorted(competencias)
    assert all(value.startswith("2024-") for value in competencias)

    sexos = {row["sexo"] for row in payload["obitos_por_sexo"]}
    assert sexos.issubset({"Masculino", "Feminino", "Ignorado"})
    assert "total_custos" not in payload


def test_sim_municipios_has_pagination_and_null_safe_rates(client):
    response = client.get(
        "/api/sim/municipios",
        params={"dimensao": "residencia", "ano": 2024, "page_size": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 3
    assert len(payload["municipios"]) <= 3
    assert payload["total"] > 0
    assert all("populacao_status" in row for row in payload["municipios"])
    assert all("frota_status" in row for row in payload["municipios"])


def test_sim_geo_ba_2024_has_fleet_rate_when_mart_joined(client):
    response = client.get(
        "/api/sim/geo",
        params={"dimensao": "ocorrencia", "ano": 2024, "uf": "BA"},
    )
    assert response.status_code == 200
    features = response.json()["features"]
    with_fleet = [
        feature
        for feature in features
        if feature["properties"]["frota_status"] == "disponivel"
        and feature["properties"]["taxa_obitos_10mil_veiculos"] is not None
    ]
    assert with_fleet, "esperado ao menos um municipio BA/2024 com frota pareada"


def test_sim_metadata_catalog(client):
    response = client.get("/api/sim/metadata")
    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload["datasets"]}
    assert "sim_silver_nacional_v2" in ids
    assert "senatran_frota" in ids


def test_populacao_cobertura_ba(client):
    response = client.get(
        "/api/sim/populacao/cobertura", params={"dimensao": "ocorrencia", "uf": "BA"}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_municipio_ano"] > 0
    assert payload["exata"] + payload["estimada"] + payload["indisponivel"] == (
        payload["total_municipio_ano"]
    )
    assert payload["exata"] > 0
    assert payload["estimada"] > 0


def test_populacao_cobertura_brasil_maior_que_ba(client):
    ba = client.get(
        "/api/sim/populacao/cobertura", params={"dimensao": "ocorrencia", "uf": "BA"}
    ).json()
    brasil = client.get(
        "/api/sim/populacao/cobertura", params={"dimensao": "ocorrencia"}
    ).json()
    assert brasil["total_municipio_ano"] > ba["total_municipio_ano"]


def test_sim_municipio_residence_has_role_and_series(client):
    listing = client.get(
        "/api/sim/municipios",
        params={"dimensao": "residencia", "page_size": 1},
    )
    code = listing.json()["municipios"][0]["cod_mun_ibge"]
    response = client.get(
        f"/api/sim/municipio/{code}",
        params={"dimensao": "residencia", "ano": 2024},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["dimensao"] == "residencia"
    assert payload["total_obitos"] > 0
    assert isinstance(payload["serie_mensal"], list)
    assert "taxa_obitos_100mil" in payload


def test_sim_filters_and_geojson_are_sim_only(client):
    response = client.get(
        "/api/sim/summary",
        params={"dimensao": "ocorrencia", "ano": 2024, "regiao": "Nordeste"},
    )
    assert response.status_code == 200
    assert response.json()["total_obitos"] > 0

    invalid = client.get("/api/sim/summary", params={"regiao": "Atlantida"})
    assert invalid.status_code == 422

    geo = client.get("/api/sim/geo", params={"dimensao": "ocorrencia", "ano": 2024})
    assert geo.status_code == 200
    payload = geo.json()
    assert payload["type"] == "FeatureCollection"
    assert payload["features"]
    properties = payload["features"][0]["properties"]
    assert properties["valor"] >= 0
    assert "total_custos" not in properties


def test_onsv_comparison_is_not_a_public_feature(client):
    response = client.get("/api/dashboard/auditoria/onsv-2024")
    assert response.status_code == 404


def test_sim_geo_applies_vehicle_filter_and_keeps_region_polygons(client):
    params = {"dimensao": "ocorrencia", "ano": 2024, "uf": "BA"}
    baseline_response = client.get("/api/sim/geo", params=params)
    assert baseline_response.status_code == 200
    baseline = baseline_response.json()
    baseline_features = baseline["features"]
    assert len(baseline_features) >= 400
    assert all(feature["properties"]["uf"] == "BA" for feature in baseline_features)
    baseline_total = sum(feature["properties"]["valor"] for feature in baseline_features)

    tipos_response = client.get("/api/sim/tipos-veiculo", params={"dimensao": "ocorrencia"})
    assert tipos_response.status_code == 200
    filtered = None
    for tipo in tipos_response.json()["tipos"]:
        response = client.get("/api/sim/geo", params={**params, "tipo_veiculo": tipo})
        assert response.status_code == 200
        payload = response.json()
        total = sum(feature["properties"]["valor"] for feature in payload["features"])
        if total != baseline_total:
            filtered = payload
            break

    assert filtered is not None
    assert len(filtered["features"]) == len(baseline_features)
    assert sum(feature["properties"]["valor"] for feature in filtered["features"]) != baseline_total
    assert any(feature["properties"]["has_data"] is False for feature in baseline_features)


def test_sim_geo_exposes_vehicle_rate_contract_without_zero_fallback(client):
    response = client.get(
        "/api/sim/geo",
        params={"dimensao": "ocorrencia", "ano": 2024, "uf": "BA"},
    )
    assert response.status_code == 200
    features = response.json()["features"]
    assert features
    for feature in features:
        properties = feature["properties"]
        assert "frota_status" in properties
        assert "taxa_obitos_10mil_veiculos" in properties
        if properties["frota_status"] == "indisponivel":
            assert properties["taxa_obitos_10mil_veiculos"] is None

    historical = client.get(
        "/api/sim/geo",
        params={"dimensao": "ocorrencia", "uf": "BA"},
    )
    assert historical.status_code == 200
    assert all(
        feature["properties"]["frota_status"] == "indisponivel"
        and feature["properties"]["taxa_obitos_10mil_veiculos"] is None
        for feature in historical.json()["features"]
    )
