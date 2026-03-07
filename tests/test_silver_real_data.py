"""Testes do Silver com dados simulando o formato REAL do PySUS/DATASUS.

Schema real verificado via scripts/inspect_pysus_schema.py em ~/pysus/:
- SIM (DOBA*.parquet): todas colunas VARCHAR, DTOBITO="DDMMYYYY",
  CODMUNOCOR="293330 " (trailing spaces), IDADE="498" (3-digit code),
  CAUSABAS="I64 " (trailing spaces)
- SIA (PABA*.parquet): todas colunas VARCHAR, PA_CMP="201901",
  PA_MUNPCN="292530" (NÃO existe PA_CODMUN), PA_FLIDADE="1",
  PA_VALAPR="                        10.90" (leading spaces)
"""

from pathlib import Path

import duckdb
import pandas as pd
import pytest


@pytest.fixture()
def datasus_real_sim(tmp_path: Path):
    """Gera dados SIM no formato REAL: todas VARCHAR, trailing spaces, IDADE codificado."""
    records = [
        {"CAUSABAS": "V209", "DTOBITO": "15032024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "1", "IDADE": "425", "UF": "BA"},
        {"CAUSABAS": "V499 ", "DTOBITO": "20062024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "2", "IDADE": "432", "UF": "BA"},
        {"CAUSABAS": "V019", "DTOBITO": "01012024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "1", "IDADE": "310", "UF": "BA"},
        {"CAUSABAS": "V891 ", "DTOBITO": "25122024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "1", "IDADE": "498", "UF": "BA"},
        {"CAUSABAS": "V299", "DTOBITO": "11042024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "1", "IDADE": "510", "UF": "BA"},
        {"CAUSABAS": "X999 ", "DTOBITO": "01012024", "CODMUNOCOR": "2927408 ",
         "CODMUNRES": "2927408 ", "SEXO": "1", "IDADE": "430", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sim_real.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


@pytest.fixture()
def datasus_real_sia(tmp_path: Path):
    """Gera dados SIA no formato REAL 2024: PA_CMP, PA_MUNPCN (NÃO PA_CODMUN),
    PA_FLIDADE, PA_VALAPR com leading spaces."""
    records = [
        {"PA_CIDPRI": "V209", "PA_MUNPCN": "292740", "PA_CMP": "202403",
         "PA_VALAPR": "                     1250.50", "PA_QTDAPR": "                   2",
         "PA_SEXO": "M", "PA_IDADE": "025", "PA_FLIDADE": "1", "UF": "BA"},
        {"PA_CIDPRI": "V499", "PA_MUNPCN": "292740", "PA_CMP": "202406",
         "PA_VALAPR": "                     3500.00", "PA_QTDAPR": "                   1",
         "PA_SEXO": "F", "PA_IDADE": "045", "PA_FLIDADE": "1", "UF": "BA"},
        {"PA_CIDPRI": "V019", "PA_MUNPCN": "292740", "PA_CMP": "202401",
         "PA_VALAPR": "                      800.25", "PA_QTDAPR": "                   3",
         "PA_SEXO": "M", "PA_IDADE": "008", "PA_FLIDADE": "2", "UF": "BA"},
        {"PA_CIDPRI": "X999", "PA_MUNPCN": "292740", "PA_CMP": "202401",
         "PA_VALAPR": "                      500.00", "PA_QTDAPR": "                   1",
         "PA_SEXO": "M", "PA_IDADE": "030", "PA_FLIDADE": "1", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sia_real.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


@pytest.fixture()
def datasus_old_sia(tmp_path: Path):
    """Gera dados SIA no formato antigo: PA_DATREF, PA_CODMUN."""
    records = [
        {"PA_CIDPRI": "V209", "PA_CODMUN": "2927408", "PA_DATREF": "202303",
         "PA_VALAPR": "1100.00", "PA_QTDAPR": "1", "PA_SEXO": "M",
         "PA_IDADE": "030", "UF": "BA"},
        {"PA_CIDPRI": "V499", "PA_CODMUN": "2927408", "PA_DATREF": "202306",
         "PA_VALAPR": "2200.00", "PA_QTDAPR": "2", "PA_SEXO": "F",
         "PA_IDADE": "020", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sia_old.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


def _reload_silver():
    """Recarrega modulo silver para pegar settings atualizados."""
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")
    reload(silver_mod)
    return silver_mod


def test_silver_sim_real_dtobito(datasus_real_sim, tmp_path):
    """Silver SIM deve converter DTOBITO formato DDMMYYYY para DATE."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 5, f"Devem ser 5 registros V01-V89 (X999 filtrado), got {len(df)}"
    assert df["dt_obito"].notna().all(), "Todas as datas devem ser parseadas"


def test_silver_sim_real_idade_decode(datasus_real_sim, tmp_path):
    """Silver SIM deve decodificar IDADE DATASUS (425→25, 310→0, 498→98, 510→110)."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT idade, faixa_etaria FROM '{result}' ORDER BY idade").fetchdf()
    con.close()

    idades = sorted(df["idade"].tolist())
    assert 0 in idades, "IDADE 310 (5 meses) deve decodificar para 0 anos"
    assert 25 in idades, "IDADE 425 deve decodificar para 25 anos"
    assert 32 in idades, "IDADE 432 deve decodificar para 32 anos"
    assert 98 in idades, "IDADE 498 deve decodificar para 98 anos"
    assert 110 in idades, "IDADE 510 deve decodificar para 110 anos"


def test_silver_sim_real_trailing_spaces(datasus_real_sim, tmp_path):
    """Silver SIM deve remover trailing spaces de CODMUNOCOR e CAUSABAS."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT cod_mun_ocorrencia, causabas FROM '{result}'").fetchdf()
    con.close()

    for val in df["cod_mun_ocorrencia"]:
        assert val == val.strip(), f"Trailing space em cod_mun_ocorrencia: '{val}'"
    for val in df["causabas"]:
        assert val == val.strip(), f"Trailing space em causabas: '{val}'"


def test_silver_sim_real_cid_filter(datasus_real_sim, tmp_path):
    """Silver SIM deve filtrar apenas CID V01-V89, excluindo X999."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    cids = con.sql(f"SELECT DISTINCT cid_grupo FROM '{result}'").fetchdf()
    con.close()

    for cid in cids["cid_grupo"]:
        assert cid >= "V01" and cid <= "V89", f"CID {cid} fora do range V01-V89"


def test_silver_sia_real_pa_cmp_munpcn(datasus_real_sia, tmp_path):
    """Silver SIA deve processar dados 2024 reais:
    PA_CMP, PA_MUNPCN, PA_VALAPR com espaços, PA_FLIDADE."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sia(datasus_real_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 3, f"Devem ser 3 registros V01-V89 (X999 filtrado), got {len(df)}"
    assert df["valor_aprovado"].sum() > 0, "Valores financeiros devem ser positivos"
    assert df["competencia"].notna().all(), "Competências devem ser parseadas"
    assert set(df["uf"]) == {"BA"}

    for val in df["cod_mun"]:
        assert val == val.strip(), f"Space em cod_mun: '{val}'"


def test_silver_sia_real_pa_flidade(datasus_real_sia, tmp_path):
    """Silver SIA deve usar PA_FLIDADE: '2' (meses) → idade 0 anos."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sia(datasus_real_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT idade, faixa_etaria FROM '{result}'").fetchdf()
    con.close()

    idades = sorted(df["idade"].tolist())
    assert 0 in idades, "PA_IDADE=008 com PA_FLIDADE=2 (meses) deve dar 0 anos"
    assert 25 in idades, "PA_IDADE=025 com PA_FLIDADE=1 (anos) deve dar 25 anos"


def test_silver_sia_real_leading_spaces_valapr(datasus_real_sia, tmp_path):
    """Silver SIA deve parsear PA_VALAPR com leading spaces."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sia(datasus_real_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT valor_aprovado FROM '{result}'").fetchdf()
    con.close()

    vals = sorted(df["valor_aprovado"].tolist())
    assert 800.25 in vals, f"PA_VALAPR '          800.25' deve virar 800.25, got {vals}"
    assert 1250.50 in vals


def test_silver_sia_old_pa_datref(datasus_old_sia, tmp_path):
    """Silver SIA deve processar dados com PA_DATREF + PA_CODMUN (layout antigo)."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver2")
    silver_mod = _reload_silver()
    result = silver_mod.processar_silver_sia(datasus_old_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 2, f"Devem ser 2 registros V01-V89, got {len(df)}"
    assert df["competencia"].notna().all()
