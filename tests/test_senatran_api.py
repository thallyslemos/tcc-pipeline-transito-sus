"""Contratos HTTP da dimensão de frota SENATRAN validada."""


def test_senatran_metadata_has_validated_annual_grain(client):
    response = client.get("/api/senatran/metadata")
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SENATRAN/RENAVAM"
    assert payload["periodo"] == {"inicio": 2010, "fim": 2024}
    assert payload["referencia_temporal"].startswith("estoque registrado em dezembro")
    assert payload["municipios"] == 5570


def test_senatran_municipal_search_is_paginated_and_seven_digit(client):
    response = client.get(
        "/api/senatran/municipios",
        params={"ano": 2024, "uf": "BA", "search": "Conquista", "page_size": 5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["referencia"] == "dezembro/2024"
    assert payload["total"] == 1
    row = payload["municipios"][0]
    assert row["cod_mun_ibge"] == "2933307"
    assert row["frota_total"] == 189600
    assert row["frota_duas_rodas_motorizadas"] == (
        row["motocicleta"] + row["motoneta"] + row["ciclomotor"]
    )


def test_senatran_detail_exposes_series_and_type_composition(client):
    response = client.get("/api/senatran/municipio/2933307", params={"ano": 2024})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["serie_anual"]) == 15
    assert payload["serie_anual"][-1]["ano"] == 2024
    assert payload["composicao"]
    assert {row["codigo"] for row in payload["composicao"]}.issuperset(
        {"motocicleta", "motoneta", "ciclomotor"}
    )


def test_sim_rate_uses_same_year_fleet_and_degrades_without_year(client):
    annual = client.get(
        "/api/sim/municipios",
        params={
            "dimensao": "residencia",
            "ano": 2024,
            "uf": "BA",
            "search": "Conquista",
            "page_size": 5,
        },
    )
    assert annual.status_code == 200
    row = annual.json()["municipios"][0]
    assert row["frota_status"] == "disponivel"
    assert row["frota_total"] == 189600
    assert row["taxa_obitos_10mil_veiculos"] == row["obitos"] * 10000 / 189600

    historical = client.get(
        "/api/sim/municipios",
        params={"dimensao": "residencia", "uf": "BA", "page_size": 1},
    )
    assert historical.status_code == 200
    historical_row = historical.json()["municipios"][0]
    assert historical_row["frota_status"] == "indisponivel"
    assert historical_row["taxa_obitos_10mil_veiculos"] is None
