"""Testes da API FastAPI (endpoints do dashboard e indicadores).

Estes testes são projetados para serem robustos contra mudanças nos dados,
buscando dinamicamente anos e municípios disponíveis para testar.
"""

import pytest
from fastapi.testclient import TestClient

from .conftest import normalize_str

_UFS_BR = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]


def _ufs_com_obitos(client: TestClient) -> set[str]:
    r = client.get("/api/dashboard/municipios")
    r.raise_for_status()
    return {m["uf"] for m in r.json()["municipios"]}


def _uf_sem_obitos(client: TestClient) -> str:
    """UF da federação sem nenhum município na base (para testar filtro vazio)."""
    presentes = _ufs_com_obitos(client)
    for uf in _UFS_BR:
        if uf not in presentes:
            return uf
    pytest.skip("Dataset cobre todas as UFs; não há UF vazia para asserção")


def _regiao_sem_obitos(client: TestClient) -> str:
    """Nome de região (REGIOES) cuja união de UFs não intersecta os dados."""
    from backend.routers.utils import REGIOES

    presentes = _ufs_com_obitos(client)
    for nome, ufs in REGIOES.items():
        if not any(u in presentes for u in ufs):
            return nome
    pytest.skip("Todas as regiões têm dados; não há região vazia para asserção")


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
    uf_com_dados = sorted(_ufs_com_obitos(client))[0]
    r = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&uf={uf_com_dados}")
    assert r.status_code == 200
    d = r.json()
    assert d["total_obitos"] > 0

    uf_vazia = _uf_sem_obitos(client)
    r_sp = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&uf={uf_vazia}")
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
    uf_com = sorted(_ufs_com_obitos(client))[0]
    r_ba = client.get(f"/api/dashboard/municipios?uf={uf_com}")
    assert r_ba.status_code == 200
    munis_ba = r_ba.json()["municipios"]
    assert len(munis_ba) > 0
    assert all(m["uf"] == uf_com for m in munis_ba)

    uf_vazia = _uf_sem_obitos(client)
    r_sp = client.get(f"/api/dashboard/municipios?uf={uf_vazia}")
    assert r_sp.status_code == 200
    munis_sp = r_sp.json()["municipios"]
    assert len(munis_sp) == 0


def test_dashboard_summary_filtro_regiao(client: TestClient, ano_disponivel: int):
    """Verifica o filtro de região no summary."""
    # O dataset de teste tem 'BA', que é Nordeste
    r_ne = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&regiao=Nordeste")
    assert r_ne.status_code == 200
    d_ne = r_ne.json()
    assert d_ne["total_obitos"] > 0
    assert "Nordeste" in d_ne["periodo"]

    reg_vazia = _regiao_sem_obitos(client)
    r_se = client.get(f"/api/dashboard/summary?ano={ano_disponivel}&regiao={reg_vazia}")
    assert r_se.status_code == 200
    assert r_se.json()["total_obitos"] == 0


def test_listar_municipios_filtro_regiao(client: TestClient):
    """Verifica se o endpoint de listar municipios funciona com filtro de região."""
    r_ne = client.get("/api/dashboard/municipios?regiao=Nordeste")
    assert r_ne.status_code == 200
    munis_ne = r_ne.json()["municipios"]
    assert len(munis_ne) > 0
    # Verifica se todos os municípios retornados são do Nordeste
    from backend.routers.utils import REGIOES
    ufs_ne = REGIOES["Nordeste"]
    assert all(m["uf"] in ufs_ne for m in munis_ne)


def test_mapa_filtro_regiao(client: TestClient, ano_disponivel: int):
    """Verifica o filtro de região no endpoint do mapa."""
    r_ne = client.get(f"/api/dashboard/mapa?metrica=obitos&ano={ano_disponivel}&regiao=Nordeste")
    assert r_ne.status_code == 200
    d_ne = r_ne.json()
    assert len(d_ne["dados"]) > 0

    from backend.routers.utils import REGIOES
    ufs_ne = REGIOES["Nordeste"]
    assert all(d["uf"] in ufs_ne for d in d_ne["dados"])


def test_geojson_filtro_regiao(client: TestClient, ano_disponivel: int):
    """Verifica o filtro de região no endpoint GeoJSON."""
    r_ne = client.get(f"/api/geo/municipios?ano={ano_disponivel}&regiao=Nordeste")
    assert r_ne.status_code == 200
    d_ne = r_ne.json()
    assert d_ne["type"] == "FeatureCollection"
    assert len(d_ne["features"]) > 0

    from backend.routers.utils import REGIOES
    ufs_ne = REGIOES["Nordeste"]
    for feat in d_ne["features"]:
        assert feat["properties"]["uf"] in ufs_ne


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


def test_municipio_detalhe_com_dimensao(client: TestClient, ano_disponivel: int):
    """Verifica se o parâmetro dimensao funciona no detalhe de município."""
    # Primeiro obtém um código de município disponível
    r_mun = client.get("/api/dashboard/municipios")
    assert r_mun.status_code == 200
    munis = r_mun.json()["municipios"]
    assert len(munis) > 0
    cod_mun = munis[0]["cod_mun_ibge"]

    # Testa com dimensão residência
    r = client.get(f"/api/dashboard/municipio/{cod_mun}?ano={ano_disponivel}&dimensao=residencia")
    assert r.status_code == 200
    d = r.json()
    assert d["dimensao_ativa"] == "residencia"

    # Testa com dimensão ocorrência (padrão)
    r2 = client.get(f"/api/dashboard/municipio/{cod_mun}?ano={ano_disponivel}&dimensao=ocorrencia")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["dimensao_ativa"] == "ocorrencia"


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
    uf_com = sorted(_ufs_com_obitos(client))[0]
    r_ba = client.get(f"/api/dashboard/mapa?metrica=obitos&ano={ano_disponivel}&uf={uf_com}")
    assert r_ba.status_code == 200
    d_ba = r_ba.json()
    assert len(d_ba["dados"]) > 0
    assert all(d["uf"] == uf_com for d in d_ba["dados"])

    uf_vazia = _uf_sem_obitos(client)
    r_sp = client.get(f"/api/dashboard/mapa?metrica=obitos&ano={ano_disponivel}&uf={uf_vazia}")
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


def test_ranking_filtros_geograficos(client: TestClient, ano_disponivel: int):
    """Verifica se o ranking aceita filtros de UF e região."""
    # Filtro por região (Nordeste tem BA, que é o único estado no dataset de teste)
    r_ne = client.get(
        f"/api/indicadores/ranking?ano={ano_disponivel}&metrica=taxa_obitos_100mil&regiao=Nordeste"
    )
    assert r_ne.status_code == 200
    d_ne = r_ne.json()
    # O ranking pode estar vazio se não houver dados populacionais para o ano/região,
    # mas o endpoint deve retornar 200 e a estrutura correta
    assert "ranking" in d_ne
    assert "ano" in d_ne
    assert "metrica" in d_ne
    # Se houver resultados, todos devem ser do Nordeste
    if len(d_ne["ranking"]) > 0:
        from backend.routers.utils import REGIOES
        ufs_ne = REGIOES["Nordeste"]
        assert all(m["uf"] in ufs_ne for m in d_ne["ranking"])

    # Filtro por UF (BA tem dados)
    r_ba = client.get(
        f"/api/indicadores/ranking?ano={ano_disponivel}&metrica=taxa_obitos_100mil&uf=BA"
    )
    assert r_ba.status_code == 200
    d_ba = r_ba.json()
    assert "ranking" in d_ba
    # Se houver resultados, todos devem ser de BA
    if len(d_ba["ranking"]) > 0:
        assert all(m["uf"] == "BA" for m in d_ba["ranking"])


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
