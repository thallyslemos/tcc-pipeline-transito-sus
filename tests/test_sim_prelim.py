# ruff: noqa: E501
"""Contratos obrigatorios da camada SIM PRELIMINAR (paralela, isolada da consolidada).

Cobre exatamente os requisitos mandatorios da feature:
- suite consolidada intacta / valores de regressao nunca mudam (ver test_sim_api.py
  e as asserções de regressão abaixo, reexecutadas aqui contra os marts reais);
- nenhum caminho de codigo consolidado le `data/*/prelim/`;
- toda linha das camadas preliminares tem `is_preliminar = true`;
- `/api/sim/prelim/*` sempre devolve o bloco `aviso_preliminar`;
- os endpoints antigos (`/api/sim/*`) nunca devolvem dado preliminar, sob
  nenhuma combinacao de parametros.
"""

from __future__ import annotations

import importlib
import json
import re
from pathlib import Path

import duckdb
import pytest

silver_prelim = importlib.import_module("data-pipeline.silver_prelim")
sim_prelim_gold = importlib.import_module("data-pipeline.sim_prelim_gold")

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Fixtures sinteticas (Bronze PRELIMINAR + manifesto), no padrao de
# tests/test_silver_v2.py e tests/test_sim_evidence.py.
# ---------------------------------------------------------------------------


def _write_bronze(path: Path) -> None:
    """Bronze PRELIMINAR sintetico: 2 registros distintos no mesmo mes/UF (um
    deles duplicado fisicamente, para provar que o Gold preliminar deduplica
    por record_id) + 1 registro fora do filtro V01-V89 (nao-ATT)."""
    con = duckdb.connect(":memory:")
    try:
        sql = """
            CREATE TABLE sim(
                CAUSABAS VARCHAR, DTOBITO VARCHAR, IDADE VARCHAR, SEXO VARCHAR,
                CODMUNRES VARCHAR, CODMUNOCOR VARCHAR, UF VARCHAR, TIPOBITO VARCHAR
            )
        """
        con.sql(sql)
        rows = [
            "('V499', '15012025', '030', '1', '292740', '292740', 'BA', '2')",
            "('V499', '15012025', '030', '1', '292740', '292740', 'BA', '2')",
            "('A419', '20012025', '045', '2', '292740', '292740', 'BA', '2')",
        ]
        for row in rows:
            con.sql(f"INSERT INTO sim VALUES {row}")
        con.sql(f"COPY sim TO '{path}' (FORMAT PARQUET)")
    finally:
        con.close()


def _write_manifest(manifest_path: Path, bronze_filename: str) -> None:
    entry = {
        "source_identity": "SIM_PRELIM:DO:BA:2025:test",
        "source_reference": "DOBA2025.dbc",
        "dataset": "SIM_PRELIM",
        "group": "DO",
        "uf": "BA",
        "year": 2025,
        "target_path": bronze_filename,
        "status": "approved",
        "dbc_source_reference": "DOBA2025.dbc",
        "dbc_sha256": "a" * 64,
        "dbc_size_bytes": 12345,
        "extracted_at": "2026-08-20T10:00:00+00:00",
    }
    manifest_path.write_text(json.dumps({"entries": [entry]}), encoding="utf-8")


def _build_silver(tmp_path: Path) -> Path:
    bronze_dir = tmp_path / "bronze_prelim"
    bronze_dir.mkdir()
    bronze_file = bronze_dir / "sim_prelim_ba_2025.parquet"
    _write_bronze(bronze_file)
    manifest_path = bronze_dir / "sim_prelim_manifest.json"
    _write_manifest(manifest_path, bronze_file.name)

    silver_path = tmp_path / "sim_prelim_nacional.parquet"
    silver_prelim.processar_silver_sim_prelim(
        bronze_dir, destino=silver_path, manifest_path=manifest_path
    )
    return silver_path


def _fetchone(path: Path, sql: str):
    con = duckdb.connect(":memory:")
    try:
        return con.sql(sql.format(p=str(path))).fetchone()
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Silver PRELIMINAR
# ---------------------------------------------------------------------------


def test_silver_prelim_marca_is_preliminar_e_propaga_proveniencia(tmp_path: Path):
    silver_path = _build_silver(tmp_path)
    con = duckdb.connect(":memory:")
    try:
        df = con.sql(f"SELECT * FROM '{silver_path}' ORDER BY source_row_number").df()
    finally:
        con.close()

    assert len(df) == 3
    assert (df["is_preliminar"] == True).all()  # noqa: E712
    assert (df["data_extracao"].astype(str) == "2026-08-20").all()
    assert (df["arquivo_origem"] == "DOBA2025.dbc").all()
    assert (df["sha256_origem"] == "a" * 64).all()
    # Filtro por PREFIXO (V01-V89): V499 dentro, A419 fora.
    assert set(df.loc[df["causabas"] == "V499", "is_v01_v89"]) == {True}
    assert set(df.loc[df["causabas"] == "A419", "is_v01_v89"]) == {False}
    assert df.loc[df["causabas"] == "V499", "qa_status"].iloc[0] == "ok"
    assert df.loc[df["causabas"] == "A419", "qa_status"].iloc[0] == "review"
    # TIPOBITO=2 (nao fetal) confirmado; nenhuma linha sintetica e fetal (1).
    assert (df["is_obito_nao_fetal"] == True).all()  # noqa: E712
    assert df["record_id"].is_unique


def test_silver_prelim_exige_manifesto_com_provenencia_completa(tmp_path: Path):
    bronze_dir = tmp_path / "bronze_prelim"
    bronze_dir.mkdir()
    bronze_file = bronze_dir / "sim_prelim_ba_2025.parquet"
    _write_bronze(bronze_file)

    # Sem manifesto: nunca ha fallback "legado" para a preliminar.
    with pytest.raises(FileNotFoundError):
        silver_prelim.processar_silver_sim_prelim(bronze_dir, destino=tmp_path / "out.parquet")

    # Manifesto presente mas sem dbc_sha256/extracted_at: rejeitado.
    manifest_path = bronze_dir / "sim_prelim_manifest.json"
    entry = {
        "source_identity": "x",
        "target_path": bronze_file.name,
        "status": "approved",
    }
    manifest_path.write_text(json.dumps({"entries": [entry]}), encoding="utf-8")
    with pytest.raises(ValueError):
        silver_prelim.processar_silver_sim_prelim(
            bronze_dir, destino=tmp_path / "out.parquet", manifest_path=manifest_path
        )


def test_silver_prelim_destino_default_nunca_coincide_com_consolidado():
    """Guarda-corpo direto contra o principio nao-negociavel: o destino default
    do Silver PRELIMINAR nao pode coincidir com o Silver consolidado.

    Inspeciona o codigo-fonte (sem executar com destino default, que escreveria
    em data/silver/ real) para confirmar o nome de arquivo default."""
    assert silver_prelim.DEFAULT_LAYOUT_VERSION != "sim_v2_0_1"
    source = Path(silver_prelim.__file__).read_text(encoding="utf-8")
    match = re.search(r'destino or settings\.resolve\(settings\.silver_dir\) / "([^"]+)"', source)
    assert match is not None, "destino default do Silver PRELIMINAR nao encontrado no codigo-fonte"
    default_filename = match.group(1)
    assert default_filename == "sim_prelim_nacional.parquet"
    assert default_filename != "sim_v2_nacional.parquet"


# ---------------------------------------------------------------------------
# Gold PRELIMINAR
# ---------------------------------------------------------------------------


def test_gold_prelim_deduplica_por_record_id_e_marca_is_preliminar(tmp_path: Path):
    silver_path = _build_silver(tmp_path)
    mart_path = tmp_path / "sim_prelim_municipio_mes_ocorrencia.parquet"
    sim_prelim_gold.materializar_mart_prelim_municipal(
        silver_path, role="ocorrencia", destino=mart_path
    )

    con = duckdb.connect(":memory:")
    try:
        df = con.sql(f"SELECT * FROM '{mart_path}'").df()
    finally:
        con.close()

    assert len(df) == 1  # um unico grupo municipio/mes/tipo/faixa/sexo
    row = df.iloc[0]
    # 2 linhas fisicas identicas no Bronze => 2 record_id distintos (hash inclui
    # source_row_number) => total_obitos (COUNT DISTINCT record_id) == 2,
    # coincidindo aqui com registros_brutos porque nao ha duplicidade real de
    # record_id, apenas de conteudo.
    assert int(row["total_obitos"]) == 2
    assert int(row["registros_brutos"]) == 2
    assert bool(row["is_preliminar"]) is True
    assert row["data_extracao"] is not None
    assert row["arquivo_origem"] == "DOBA2025.dbc"
    assert row["sha256_origem"] == "a" * 64
    assert row["ano"] == 2025 and row["mes"] == 1


def test_gold_prelim_nunca_escreve_em_data_gold_sim_v1(tmp_path: Path):
    assert set(sim_prelim_gold.PRELIM_MART_FILENAMES.values()) == {
        "sim_prelim_municipio_mes_ocorrencia.parquet",
        "sim_prelim_municipio_mes_residencia.parquet",
    }
    for filename in sim_prelim_gold.PRELIM_MART_FILENAMES.values():
        assert not filename.startswith("sim_v1")


# ---------------------------------------------------------------------------
# Isolamento estatico: nenhum modulo consolidado le data/*/prelim/.
# ---------------------------------------------------------------------------

_CONSOLIDATED_MODULES = [
    "data-pipeline/silver.py",
    "data-pipeline/silver_v2.py",
    "data-pipeline/sim_evidence.py",
    "data-pipeline/datasus.py",
    "data-pipeline/gold.py",
    "data-pipeline/gold_timeseries.py",
    "backend/routers/sim_only.py",
    "backend/routers/sim_temporal.py",
    "backend/routers/dashboard.py",
    "backend/routers/geo.py",
    "backend/routers/indicadores.py",
]


@pytest.mark.parametrize("relative_path", _CONSOLIDATED_MODULES)
def test_modulo_consolidado_nao_referencia_camada_preliminar(relative_path: str):
    path = PROJECT_ROOT / relative_path
    assert path.exists(), f"modulo esperado nao encontrado: {relative_path}"
    source = path.read_text(encoding="utf-8")
    assert "prelim" not in source.lower(), (
        f"{relative_path} referencia 'prelim' — camada consolidada nao pode "
        "conhecer a camada preliminar"
    )


def test_manifesto_preliminar_e_isolado_do_manifesto_consolidado():
    ingest = (PROJECT_ROOT / "data-pipeline" / "sim_prelim_ingest.py").read_text(encoding="utf-8")
    assert "sim_prelim_manifest.json" in ingest
    assert "data/bronze/prelim" in ingest or "bronze_dir) / \"prelim\"" in ingest.replace("'", '"')
    assert re.search(r'settings\.bronze_dir\)\s*/\s*"prelim"', ingest)


# ---------------------------------------------------------------------------
# Contratos HTTP: /api/sim/prelim/* sempre com aviso_preliminar; endpoints
# antigos nunca vazam dado preliminar.
# ---------------------------------------------------------------------------


@pytest.fixture
def prelim_gold_real(tmp_path: Path):
    """Materializa marts PRELIMINARES sinteticos nos caminhos reais esperados
    pelo router (settings.gold_dir real, mesmo usado pela fixture `client` de
    sessao) e remove-os ao final. Nunca sobrescreve um mart preliminar real
    (se algum dia existir de uma ingestao de verdade) — pula o teste nesse caso
    em vez de arriscar apagar dado real no teardown."""
    from backend.config import settings as backend_settings

    gold_dir = backend_settings.resolve(backend_settings.gold_dir)
    targets = {
        role: gold_dir / filename for role, filename in sim_prelim_gold.PRELIM_MART_FILENAMES.items()
    }
    for path in targets.values():
        if path.exists():
            pytest.skip(f"Mart SIM preliminar real ja existe em {path}; teste evita sobrescrever")

    silver_path = _build_silver(tmp_path)
    created: list[Path] = []
    try:
        for role, path in targets.items():
            sim_prelim_gold.materializar_mart_prelim_municipal(silver_path, role=role, destino=path)
            created.append(path)
        yield gold_dir
    finally:
        for path in created:
            path.unlink(missing_ok=True)


@pytest.mark.requires_data
def test_prelim_endpoints_sempre_retornam_aviso_preliminar(client, prelim_gold_real):
    for endpoint, params in [
        ("/api/sim/prelim/summary", {"dimensao": "ocorrencia"}),
        ("/api/sim/prelim/municipios", {"dimensao": "ocorrencia"}),
        ("/api/sim/prelim/metadata", {}),
    ]:
        response = client.get(endpoint, params=params)
        assert response.status_code == 200, response.text
        payload = response.json()
        assert "aviso_preliminar" in payload
        assert payload["aviso_preliminar"]["preliminar"] is True
        assert "sujeitos a revisao" in payload["aviso_preliminar"]["texto"]


@pytest.mark.requires_data
def test_prelim_summary_reflete_dados_sinteticos(client, prelim_gold_real):
    response = client.get(
        "/api/sim/prelim/summary", params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2025}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["fonte"] == "SIM-PRELIMINAR"
    assert payload["total_obitos"] == 2


@pytest.mark.requires_data
def test_prelim_summary_filtra_por_municipio(client, prelim_gold_real):
    response = client.get(
        "/api/sim/prelim/summary",
        params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2025, "municipio": "2927408"},
    )
    assert response.status_code == 200
    assert response.json()["total_obitos"] == 2

    vazio = client.get(
        "/api/sim/prelim/summary",
        params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2025, "municipio": "1100015"},
    )
    assert vazio.status_code == 200
    assert vazio.json()["total_obitos"] == 0


def test_prelim_municipio_invalido_retorna_422(client):
    response = client.get(
        "/api/sim/prelim/summary",
        params={"dimensao": "ocorrencia", "municipio": "12"},
    )
    assert response.status_code == 422


@pytest.mark.requires_data
def test_prelim_completude_nao_quebra_com_meses_sem_dado_preliminar(client, prelim_gold_real):
    """Regressao: o mart preliminar sintetico so tem janeiro/2025; o mart
    consolidado real de BA tem dado em todos os meses de varios anos. O FULL
    OUTER JOIN da completude produz NaN (nao None) para meses ausentes do lado
    preliminar apos fetchdf() — /completude e /summary?ano=... nao podem
    quebrar com ValueError('cannot convert float NaN to integer') nesse caso."""
    response = client.get(
        "/api/sim/prelim/completude", params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2025}
    )
    assert response.status_code == 200
    payload = response.json()
    meses = {linha["mes"]: linha for linha in payload["por_mes"]}
    assert meses[1]["obitos_prelim"] == 2
    fevereiro = meses[2]
    assert fevereiro["obitos_prelim"] is None
    assert fevereiro["completude_estimada"] is None


@pytest.mark.requires_data
def test_prelim_endpoints_503_quando_marts_ausentes(client):
    """Estado natural do repo antes da primeira ingestao preliminar real: os
    marts nao existem, e os endpoints devem falhar de forma explicita (503),
    nunca vazando um summary vazio como se fosse dado valido."""
    from backend.config import settings as backend_settings

    gold_dir = backend_settings.resolve(backend_settings.gold_dir)
    for filename in sim_prelim_gold.PRELIM_MART_FILENAMES.values():
        if (gold_dir / filename).exists():
            pytest.skip("Mart SIM preliminar real ja existe; nada a validar em estado ausente")

    response = client.get("/api/sim/prelim/summary", params={"dimensao": "ocorrencia"})
    assert response.status_code == 503

    metadata_response = client.get("/api/sim/prelim/metadata")
    assert metadata_response.status_code == 200
    payload = metadata_response.json()
    assert all(dataset["available"] is False for dataset in payload["datasets"])
    assert all(dataset["status"] == "preliminary" for dataset in payload["datasets"])


@pytest.mark.requires_data
def test_endpoints_consolidados_nunca_retornam_dado_preliminar(client):
    """Contrato negativo: nenhum parametro habilita dado preliminar em
    /api/sim/*, e os valores de regressao nunca mudam."""
    for params in [
        {"dimensao": "ocorrencia", "uf": "BA", "ano": 2024},
        {"dimensao": "ocorrencia", "uf": "BA", "ano": 2024, "preliminar": "true"},
        {"dimensao": "ocorrencia", "uf": "BA", "ano": 2024, "prelim": "1"},
        {"dimensao": "ocorrencia", "uf": "BA", "ano": 2024, "include_prelim": "yes"},
    ]:
        response = client.get("/api/sim/summary", params=params)
        assert response.status_code == 200
        payload = response.json()
        assert "aviso_preliminar" not in payload
        assert "is_preliminar" not in payload
        assert payload["total_obitos"] == 3105  # BA 2024, nunca muda

    response = client.get("/api/sim/summary", params={"dimensao": "ocorrencia", "uf": "BA"})
    assert response.json()["total_obitos"] == 37906  # BA 2010-2024

    response = client.get("/api/sim/summary", params={"dimensao": "ocorrencia", "ano": 2024})
    assert response.json()["total_obitos"] == 37150  # Brasil 2024

    response = client.get(
        "/api/sim/municipio/292740", params={"dimensao": "ocorrencia", "ano": 2024}
    )
    assert response.status_code == 200
    assert response.json()["total_obitos"] == 210  # Salvador 2024


@pytest.mark.requires_data
def test_sim_prelim_router_nao_intercepta_rotas_consolidadas(client):
    """O prefixo /api/sim/prelim nunca deve capturar chamadas para /api/sim/*."""
    response = client.get("/api/sim/summary", params={"dimensao": "ocorrencia", "uf": "BA", "ano": 2024})
    assert response.status_code == 200
    assert response.json()["fonte"] == "SIM"
