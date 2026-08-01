"""Contratos HTTP do serving SIM-only."""


def test_sim_summary_is_sim_only(client):
    response = client.get("/api/sim/summary", params={"dimensao": "ocorrencia"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SIM"
    assert payload["total_obitos"] == 565383
    assert "total_custos" not in payload
    assert payload["denominadores"]["frota"].startswith("indisponivel")


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


def test_sim_metadata_catalog(client):
    response = client.get("/api/sim/metadata")
    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload["datasets"]}
    assert "sim_silver_nacional_v2" in ids
    assert "senatran_frota" in ids


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
