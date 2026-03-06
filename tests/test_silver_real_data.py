"""Testes do Silver com dados simulando o formato real do DATASUS (PySUS).

No PySUS, todas as colunas vêm como VARCHAR. DTOBITO é 'DDMMYYYY'.
IDADE é código de 3 dígitos DATASUS (4xx = anos, 3xx = meses, etc).
Este teste garante que o Silver processa corretamente ambos os formatos.
"""

from pathlib import Path

import duckdb
import pandas as pd
import pytest


@pytest.fixture()
def datasus_real_sim(tmp_path: Path):
    """Gera dados SIM no formato real DATASUS: todas as colunas VARCHAR."""
    records = [
        {"CAUSABAS": "V209", "DTOBITO": "15032024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "1", "IDADE": "425", "UF": "BA"},
        {"CAUSABAS": "V499", "DTOBITO": "20062024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "2", "IDADE": "432", "UF": "BA"},
        {"CAUSABAS": "V019", "DTOBITO": "01012024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "1", "IDADE": "310", "UF": "BA"},
        {"CAUSABAS": "V891", "DTOBITO": "25122024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "1", "IDADE": "470", "UF": "BA"},
        {"CAUSABAS": "V299", "DTOBITO": "11042024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "1", "IDADE": "510", "UF": "BA"},
        {"CAUSABAS": "X999", "DTOBITO": "01012024", "CODMUNOCOR": "2927408",
         "CODMUNRES": "2927408", "SEXO": "1", "IDADE": "430", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sim_real.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


@pytest.fixture()
def datasus_real_sia(tmp_path: Path):
    """Gera dados SIA no formato real DATASUS 2024: PA_CMP (não PA_DATREF)."""
    records = [
        {"PA_CIDPRI": "V209", "PA_CODMUN": "2927408", "PA_CMP": "202403",
         "PA_VALAPR": "1250.50", "PA_QTDAPR": "2", "PA_SEXO": "M",
         "PA_IDADE": "425", "UF": "BA"},
        {"PA_CIDPRI": "V499", "PA_CODMUN": "2927408", "PA_CMP": "202406",
         "PA_VALAPR": "3500.00", "PA_QTDAPR": "1", "PA_SEXO": "F",
         "PA_IDADE": "445", "UF": "BA"},
        {"PA_CIDPRI": "V019", "PA_CODMUN": "2927408", "PA_CMP": "202401",
         "PA_VALAPR": "800.25", "PA_QTDAPR": "3", "PA_SEXO": "M",
         "PA_IDADE": "308", "UF": "BA"},
        {"PA_CIDPRI": "X999", "PA_CODMUN": "2927408", "PA_CMP": "202401",
         "PA_VALAPR": "500.00", "PA_QTDAPR": "1", "PA_SEXO": "M",
         "PA_IDADE": "430", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sia_real.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


@pytest.fixture()
def datasus_old_sia(tmp_path: Path):
    """Gera dados SIA no formato antigo: PA_DATREF (layout pré-2024)."""
    records = [
        {"PA_CIDPRI": "V209", "PA_CODMUN": "2927408", "PA_DATREF": "202303",
         "PA_VALAPR": "1100.00", "PA_QTDAPR": "1", "PA_SEXO": "M",
         "PA_IDADE": "430", "UF": "BA"},
        {"PA_CIDPRI": "V499", "PA_CODMUN": "2927408", "PA_DATREF": "202306",
         "PA_VALAPR": "2200.00", "PA_QTDAPR": "2", "PA_SEXO": "F",
         "PA_IDADE": "420", "UF": "BA"},
    ]
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].astype(str)
    parquet_path = tmp_path / "sia_old.parquet"
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    return parquet_path


def test_silver_sim_real_dtobito(datasus_real_sim, tmp_path):
    """Silver SIM deve converter DTOBITO formato DDMMYYYY para DATE."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 5, f"Devem ser 5 registros V01-V89 (X999 filtrado), got {len(df)}"
    assert df["dt_obito"].notna().all(), "Todas as datas devem ser parseadas"


def test_silver_sim_real_idade_decode(datasus_real_sim, tmp_path):
    """Silver SIM deve decodificar IDADE DATASUS (425→25, 310→0, 510→110)."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT idade, faixa_etaria FROM '{result}' ORDER BY idade").fetchdf()
    con.close()

    idades = sorted(df["idade"].tolist())
    assert 0 in idades, "IDADE 310 (5 meses) deve decodificar para 0 anos"
    assert 25 in idades, "IDADE 425 deve decodificar para 25 anos"
    assert 32 in idades, "IDADE 432 deve decodificar para 32 anos"
    assert 70 in idades, "IDADE 470 deve decodificar para 70 anos"
    assert 110 in idades, "IDADE 510 deve decodificar para 110 anos"

    faixas = set(df["faixa_etaria"].tolist())
    assert "0-14" in faixas, "Bebê deve estar na faixa 0-14"
    assert "25-34" in faixas, "25 e 32 devem estar na faixa 25-34"
    assert "65+" in faixas, "70 e 110 devem estar na faixa 65+"


def test_silver_sim_real_sexo_varchar(datasus_real_sim, tmp_path):
    """Silver SIM deve converter SEXO VARCHAR ('1'/'2') para inteiro."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT DISTINCT sexo_desc FROM '{result}'").fetchdf()
    con.close()

    sexos = set(df["sexo_desc"].tolist())
    assert "Masculino" in sexos
    assert "Feminino" in sexos


def test_silver_sim_real_cid_filter(datasus_real_sim, tmp_path):
    """Silver SIM deve filtrar apenas CID V01-V89, excluindo X999."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sim(datasus_real_sim)

    con = duckdb.connect(":memory:")
    cids = con.sql(f"SELECT DISTINCT cid_grupo FROM '{result}'").fetchdf()
    con.close()

    for cid in cids["cid_grupo"]:
        assert cid >= "V01" and cid <= "V89", f"CID {cid} fora do range V01-V89"


def test_silver_sia_real_pa_cmp(datasus_real_sia, tmp_path):
    """Silver SIA deve processar dados 2024 com PA_CMP (não PA_DATREF)."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sia(datasus_real_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 3, f"Devem ser 3 registros V01-V89 (X999 filtrado), got {len(df)}"
    assert df["valor_aprovado"].sum() > 0, "Valores financeiros devem ser positivos"
    assert df["competencia"].notna().all(), "Competências devem ser parseadas"
    assert set(df["uf"]) == {"BA"}


def test_silver_sia_old_pa_datref(datasus_old_sia, tmp_path):
    """Silver SIA deve processar dados com PA_DATREF (layout antigo)."""
    import os
    os.environ["SILVER_DIR"] = str(tmp_path / "silver2")
    from importlib import import_module, reload
    config_mod = import_module("data-pipeline.config")
    reload(config_mod)
    silver_mod = import_module("data-pipeline.silver")

    result = silver_mod.processar_silver_sia(datasus_old_sia)

    con = duckdb.connect(":memory:")
    df = con.sql(f"SELECT * FROM '{result}'").fetchdf()
    con.close()

    assert len(df) == 2, f"Devem ser 2 registros V01-V89, got {len(df)}"
    assert df["competencia"].notna().all()
