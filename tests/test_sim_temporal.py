"""Contratos HTTP dos endpoints de dimensao temporal SIM (/api/sim/temporal)."""

# Bahia/2024: valor fixado e validado contra o mart Gold mensal (mesmo total do
# /api/sim/summary). Salvador/2024 e Gaviao/2024 sao os casos-teste fixos descritos
# em ESPEC_DIMENSAO_TEMPORAL.md, secao 2.3.
_UF = "BA"
_ANO = 2024
_SALVADOR = "2927408"
_GAVIAO = "2911253"


# ---------------------------------------------------------------------------
# serie-mensal
# ---------------------------------------------------------------------------


def test_serie_mensal_bahia_2024_bate_com_summary(client):
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SIM"
    assert len(payload["pontos"]) == 12
    assert payload["resumo"]["total_obitos"] == 3105  # validado contra /api/sim/summary
    assert payload["resumo"]["meses_com_obito"] == 12


def test_serie_mensal_estrutura_do_resumo(client):
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO},
    )
    assert response.status_code == 200
    resumo = response.json()["resumo"]
    for key in (
        "media_mensal",
        "desvio_mensal",
        "mes_pico",
        "share_mes_pico",
        "meses_com_obito",
        "hhi_mensal",
        "classe_concentracao",
        "alerta",
    ):
        assert key in resumo
    assert 0.0 <= resumo["share_mes_pico"] <= 1.0
    assert resumo["classe_concentracao"] in ("concentrado", "difuso")


def test_serie_mensal_municipio_pequeno_pode_ser_concentrado(client):
    """Gaviao/2024: 20 obitos, todos em janeiro -> um unico mes com dados."""
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"dimensao": "ocorrencia", "cod_mun_ibge": _GAVIAO, "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["resumo"]["total_obitos"] == 20
    assert payload["resumo"]["meses_com_obito"] == 1
    assert payload["resumo"]["classe_concentracao"] == "concentrado"
    assert payload["resumo"]["mes_pico"] == "2024-01"


def test_serie_mensal_sem_dados_retorna_vazio_sem_erro(client):
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"dimensao": "ocorrencia", "cod_mun_ibge": "999999", "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pontos"] == []
    assert payload["resumo"]["total_obitos"] == 0
    assert payload["resumo"]["classe_concentracao"] is None


def test_serie_mensal_intervalo_de_anos(client):
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano_inicio": 2023, "ano_fim": 2024},
    )
    assert response.status_code == 200
    payload = response.json()
    competencias = [p["competencia"] for p in payload["pontos"]]
    assert any(c.startswith("2023") for c in competencias)
    assert any(c.startswith("2024") for c in competencias)


def test_serie_mensal_cod_mun_invalido_retorna_422(client):
    response = client.get(
        "/api/sim/temporal/serie-mensal",
        params={"cod_mun_ibge": "12"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# dia-semana
# ---------------------------------------------------------------------------


def test_dia_semana_salvador_2024_bate_com_caso_teste_fixo(client):
    """Casos-teste fixos de ESPEC_DIMENSAO_TEMPORAL.md (secao 7)."""
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "cod_mun_ibge": _SALVADOR, "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_obitos"] == 210
    por_dia = {d["dia_semana_nome"]: d["obitos"] for d in payload["distribuicao"]}
    assert por_dia["Segunda"] == 34
    assert por_dia["Domingo"] == 34
    assert por_dia["Terca"] == 26
    assert por_dia["Quinta"] == 23
    # Fim de semana concentra ~30% (nao os 28,6% de uma uniformidade ingenua)
    assert payload["fim_de_semana"]["proporcao_observada"] == 0.3


def test_dia_semana_distribuicao_tem_sete_dias(client):
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO},
    )
    assert response.status_code == 200
    distribuicao = response.json()["distribuicao"]
    assert len(distribuicao) == 7
    assert {d["dia_semana"] for d in distribuicao} == set(range(1, 8))


def test_dia_semana_soma_das_arestas_bate_com_total(client):
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    soma = sum(d["obitos"] for d in payload["distribuicao"])
    assert soma == payload["total_obitos"]


def test_dia_semana_denominador_calendario_nao_e_um_setimo_ingenuo(client):
    """O denominador deve variar entre dias (52 ou 53), nao ser fixo em 1/7."""
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO},
    )
    assert response.status_code == 200
    dias_calendario = {d["dias_no_calendario"] for d in response.json()["distribuicao"]}
    assert dias_calendario <= {52, 53}
    assert len(dias_calendario) >= 1


def test_dia_semana_qui_quadrado_presente_com_graus_liberdade_seis(client):
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano_inicio": 2010, "ano_fim": 2024},
    )
    assert response.status_code == 200
    qq = response.json()["qui_quadrado"]
    assert qq["gl"] == 6
    assert qq["estatistica"] is not None
    assert 0.0 <= qq["p_valor"] <= 1.0
    assert isinstance(qq["significativo_005"], bool)


def test_dia_semana_razao_fim_semana_e_positiva(client):
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano_inicio": 2010, "ano_fim": 2024},
    )
    assert response.status_code == 200
    razao = response.json()["razao_fim_semana"]
    assert razao is not None
    assert razao > 0


def test_dia_semana_sem_dados_nao_gera_erro(client):
    response = client.get(
        "/api/sim/temporal/dia-semana",
        params={"cod_mun_ibge": "999999", "ano": _ANO},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_obitos"] == 0
    assert payload["qui_quadrado"]["estatistica"] is None
    assert payload["razao_fim_semana"] is None


# ---------------------------------------------------------------------------
# outliers
# ---------------------------------------------------------------------------


def test_outliers_detecta_caso_gaviao_como_evento_unico(client):
    response = client.get(
        "/api/sim/temporal/outliers",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO, "min_obitos": 5},
    )
    assert response.status_code == 200
    municipios = response.json()["municipios"]
    gaviao = [m for m in municipios if m["cod_mun_ibge"] == _GAVIAO[:6]]
    assert len(gaviao) == 1
    assert gaviao[0]["obitos_ano"] == 20
    assert gaviao[0]["meses_com_obito"] == 1
    assert gaviao[0]["classe_concentracao"] == "evento_unico"
    assert gaviao[0]["share_dia_pico"] == 1.0


def test_outliers_somente_concentrados_exclui_difusos(client):
    response = client.get(
        "/api/sim/temporal/outliers",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO, "min_obitos": 5},
    )
    assert response.status_code == 200
    municipios = response.json()["municipios"]
    assert all(m["classe_concentracao"] != "difuso" for m in municipios)


def test_outliers_todos_inclui_difusos(client):
    response = client.get(
        "/api/sim/temporal/outliers",
        params={
            "dimensao": "ocorrencia",
            "uf": _UF,
            "ano": _ANO,
            "min_obitos": 5,
            "somente_concentrados": False,
        },
    )
    assert response.status_code == 200
    municipios = response.json()["municipios"]
    classes = {m["classe_concentracao"] for m in municipios}
    assert "difuso" in classes


def test_outliers_min_obitos_filtra_municipios_pequenos(client):
    response_baixo = client.get(
        "/api/sim/temporal/outliers",
        params={
            "dimensao": "ocorrencia",
            "uf": _UF,
            "ano": _ANO,
            "min_obitos": 1,
            "somente_concentrados": False,
        },
    )
    response_alto = client.get(
        "/api/sim/temporal/outliers",
        params={
            "dimensao": "ocorrencia",
            "uf": _UF,
            "ano": _ANO,
            "min_obitos": 100,
            "somente_concentrados": False,
        },
    )
    assert response_baixo.status_code == 200
    assert response_alto.status_code == 200
    assert len(response_baixo.json()["municipios"]) >= len(response_alto.json()["municipios"])


def test_outliers_campos_obrigatorios_presentes(client):
    response = client.get(
        "/api/sim/temporal/outliers",
        params={"dimensao": "ocorrencia", "uf": _UF, "ano": _ANO, "min_obitos": 5},
    )
    assert response.status_code == 200
    for municipio in response.json()["municipios"]:
        for key in (
            "cod_mun_ibge",
            "municipio",
            "uf",
            "ano",
            "obitos_ano",
            "meses_com_obito",
            "share_mes_pico",
            "share_dia_pico",
            "classe_concentracao",
        ):
            assert key in municipio
        assert municipio["obitos_ano"] >= 5
