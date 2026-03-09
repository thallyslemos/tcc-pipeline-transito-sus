"""Testes da API FastAPI (endpoints do dashboard e indicadores).

Estes testes são projetados para serem robustos contra mudanças nos dados,
buscando dinamicamente anos e municípios disponíveis para testar.
"""

from fastapi.testclient import TestClient

from .conftest import normalize_str


def test_health_check(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_summary(client: TestClient):
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0
    assert d["total_custos"] > 0
    assert d["total_atendimentos"] > 0
    assert d["municipios"] > 0
    assert len(d["obitos_por_ano"]) > 0
    assert len(d["serie_temporal_obitos"]) > 0


def test_dashboard_summary_by_year(client: TestClient, ano_disponivel: int):
    """Verifica se o summary anual funciona para um ano existente."""
    r = client.get(f"/api/dashboard/summary?ano={ano_disponivel}")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0
    assert d["total_custos"] > 0
    assert str(ano_disponivel) in d["periodo"]


def test_dashboard_summary_with_filters(
    client: TestClient, ano_disponivel: int, municipio_disponivel: dict
):
    """Verifica filtros de ano e município no summary."""
    cod_mun = municipio_disponivel["cod_mun_ibge"]
    r = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&municipio={cod_mun}")
    assert r.status_code == 200
    d = r.json()
    assert d["municipios"] == 1


def test_dashboard_summary_dimensao_residencia(client: TestClient, ano_disponivel: int):
    """Verifica se o parâmetro de dimensão 'residencia' é funcional."""
    r = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&dimensao=residencia")
    assert r.status_code == 200
    d = r.json()
    assert d["dimensao_ativa"] == "residencia"
    assert d["total_obitos"] > 0


def test_dashboard_summary_filtro_uf(client: TestClient, ano_disponivel: int):
    """Verifica o filtro de UF no summary."""
    # O dataset de teste atual só tem 'BA'
    uf_teste = "BA"
    r = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&uf={uf_teste}")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0

    # Verifica se um estado sem dados retorna 0 obitos
    r_sp = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&uf=SP")
    assert r_sp.status_code == 200
    d_sp = r_sp.json()
    assert d_sp["total_obitos"] == 0


def test_anos_disponiveis(client: TestClient):
    r = client.get("/api/dashboard/anos")
    assert r.status_code == 200
    assert len(r.json()["anos"]) > 0


def test_tipos_veiculo(client: TestClient):
    r = client.get("/api/dashboard/tipos-veiculo")
    assert r.status_code == 200
    assert len(r.json()["tipos"]) > 0


def test_listar_municipios(client: TestClient):
    r = client.get("/api/dashboard/municipios")
    assert r.status_code == 200
    munis = r.json()["municipios"]
    assert len(munis) > 0
    assert all("lat" in m and "lon" in m for m in munis)


def test_listar_municipios_filtro_uf(client: TestClient):
    """Verifica se o endpoint de listar municipios funciona com filtro de UF."""
    # O dataset de teste atual só tem 'BA'
    # 1. Testa com uma UF que tem dados
    r_ba = client.get("/api/dashboard/municipios?uf=BA")
    assert r_ba.status_code == 200
    munis_ba = r_ba.json()["municipios"]
    assert len(munis_ba) > 0
    assert all(m["uf"] == "BA" for m in munis_ba)

    # 2. Testa com uma UF que não tem dados
    r_sp = client.get("/api/dashboard/municipios?uf=SP")
    assert r_sp.status_code == 200
    munis_sp = r_sp.json()["municipios"]
    assert len(munis_sp) == 0


def test_municipio_detalhe(client: TestClient, municipio_disponivel: dict):
    """Verifica o endpoint de detalhe de um município dinâmico."""
    cod_mun = municipio_disponivel["cod_mun_ibge"]
    nome_mun = municipio_disponivel["nome"]
    r = client.get(f"/api/dashboard/municipio/{cod_mun}")
    assert r.status_code == 200
    d = r.json()
    assert normalize_str(d["municipio"]) == normalize_str(nome_mun)
    assert d["total_obitos"] > 0
    assert len(d["serie_obitos"]) > 0
    assert len(d["obitos_por_tipo_veiculo"]) > 0


def test_mapa_obitos(client: TestClient):
    r = client.get("/api/dashboard/mapa?metrica=obitos")
    assert r.status_code == 200
    d = r.json()
    assert d["metrica"] == "obitos"
    assert len(d["dados"]) > 0


def test_mapa_custos(client: TestClient, ano_disponivel: int):
    r = client.get(f"/api/dashboard/mapa?metrica=custos&ano={ano_disponivel}")
    assert r.status_code == 200
    d = r.json()
    assert d["metrica"] == "custos"
    assert d["ano"] == ano_disponivel


def test_mapa_filtro_uf(client: TestClient, ano_disponivel: int):
    """Verifica o filtro de UF no endpoint do mapa."""
    # 1. Testa com uma UF que tem dados
    r_ba = client.get(f"/api/dashboard/mapa?metrica=obitos&ano={ano_disponivel}&uf=BA")
    assert r_ba.status_code == 200
    d_ba = r_ba.json()
    assert len(d_ba["dados"]) > 0
    assert all(d["uf"] == "BA" for d in d_ba["dados"])

    # 2. Testa com uma UF que não tem dados
    r_sp = client.get(f"/api/dashboard/mapa?metrica=obitos&ano={ano_disponivel}&uf=SP")
    assert r_sp.status_code == 200
    d_sp = r_sp.json()
    assert len(d_sp["dados"]) == 0


def test_indicadores_municipio(client: TestClient, municipio_disponivel: dict):
    """Verifica o endpoint de indicadores para um município dinâmico."""
    cod_mun = municipio_disponivel["cod_mun_ibge"]
    nome_mun = municipio_disponivel["nome"]
    r = client.get(f"/api/indicadores/municipio/{cod_mun}")
    assert r.status_code == 200
    d = r.json()
    assert normalize_str(d["municipio"]) == normalize_str(nome_mun)
    assert d.get("idh") is None or d["idh"] > 0
    assert "indicadores" in d
    assert isinstance(d["indicadores"], list)

    if d["indicadores"]:
        ind = d["indicadores"][0]
        assert ind["taxa_obitos_100mil"] >= 0
        assert ind["custo_per_capita"] >= 0
        assert ind["populacao"] > 0
    assert "fontes" in d


def test_indicadores_municipio_by_year(
    client: TestClient, municipio_disponivel: dict, ano_disponivel: int
):
    cod_mun = municipio_disponivel["cod_mun_ibge"]
    r = client.get(f"/api/indicadores/municipio/{cod_mun}?ano={ano_disponivel}")
    assert r.status_code == 200
    d = r.json()
    # Pode não haver dados para o ano/município específico, então o teste é mais flexível
    if d.get("indicadores"):
        assert len(d["indicadores"]) <= 1
        if len(d["indicadores"]) == 1:
            assert d["indicadores"][0]["ano"] == ano_disponivel


def test_ranking(client: TestClient, ano_disponivel: int):
    """Verifica se o endpoint de ranking retorna uma lista ordenada."""
    r = client.get(
        f"/api/indicadores/ranking?ano={ano_disponivel}&metrica=taxa_obitos_100mil"
    )
    assert r.status_code == 200
    d = r.json()
    assert "ranking" in d
    if len(d["ranking"]) > 1:
        assert (
            d["ranking"][0]["taxa_obitos_100mil"]
            >= d["ranking"][-1]["taxa_obitos_100mil"]
        )


def test_cors_headers(client: TestClient):
    r = client.options(
        "/api/dashboard/summary",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
