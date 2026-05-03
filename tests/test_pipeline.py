"""Testes do pipeline ETL (Bronze → Silver → Gold)."""

from pathlib import Path

import duckdb
import pytest


@pytest.fixture()
def tmp_data(tmp_path: Path):
    """Executa pipeline completo em diretório temporário e retorna caminhos."""
    import os

    os.environ["DATA_DIR"] = str(tmp_path)
    os.environ["BRONZE_DIR"] = str(tmp_path / "bronze")
    os.environ["SILVER_DIR"] = str(tmp_path / "silver")
    os.environ["GOLD_DIR"] = str(tmp_path / "gold")

    from importlib import import_module, reload

    config_mod = import_module("data-pipeline.config")
    reload(config_mod)

    sample_mod = import_module("data-pipeline.sample_data")
    bronze_mod = import_module("data-pipeline.bronze")
    silver_mod = import_module("data-pipeline.silver")
    gold_mod = import_module("data-pipeline.gold")

    df_sim = sample_mod.gerar_sim(anos=[2022, 2023])
    df_sia = sample_mod.gerar_sia(anos=[2022, 2023])

    bronze_sim = bronze_mod.salvar_bronze(df_sim, "sim")
    bronze_sia = bronze_mod.salvar_bronze(df_sia, "sia")

    silver_sim = silver_mod.processar_silver_sim(bronze_sim)
    silver_sia = silver_mod.processar_silver_sia(bronze_sia)

    gold_obitos_ocorrencia = gold_mod.gerar_gold_obitos_ocorrencia(silver_sim)
    gold_obitos_residencia = gold_mod.gerar_gold_obitos_residencia(silver_sim)
    gold_custos = gold_mod.gerar_gold_custos(silver_sia)

    return {
        "bronze_sim": bronze_sim,
        "bronze_sia": bronze_sia,
        "silver_sim": silver_sim,
        "silver_sia": silver_sia,
        "gold_obitos_ocorrencia": gold_obitos_ocorrencia,
        "gold_obitos_residencia": gold_obitos_residencia,
        "gold_custos": gold_custos,
        "df_sim": df_sim,
        "df_sia": df_sia,
    }


def test_sample_sim_schema(tmp_data):
    """SIM deve conter todas as colunas esperadas."""
    df = tmp_data["df_sim"]
    expected = {"CAUSABAS", "DTOBITO", "CODMUNOCOR", "CODMUNRES", "SEXO", "IDADE", "UF"}
    assert expected.issubset(set(df.columns))


def test_sample_sim_cid_range(tmp_data):
    """Todos CIDs gerados devem estar em V01-V89."""
    df = tmp_data["df_sim"]
    cids = df["CAUSABAS"].str[:3]
    assert (cids >= "V01").all()
    assert (cids <= "V89").all()


def test_sample_sia_schema(tmp_data):
    """SIA deve conter todas as colunas esperadas."""
    df = tmp_data["df_sia"]
    expected = {"PA_CIDPRI", "PA_CODMUN", "PA_DATREF", "PA_VALAPR", "PA_QTDAPR", "UF"}
    assert expected.issubset(set(df.columns))


def test_bronze_parquet_exists(tmp_data):
    """Arquivos Bronze devem existir em disco."""
    assert tmp_data["bronze_sim"].exists()
    assert tmp_data["bronze_sia"].exists()


def test_silver_filtra_cid(tmp_data):
    """Silver deve manter apenas CIDs V01-V89."""
    con = duckdb.connect(":memory:")
    result = con.sql(f"""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE cid_grupo BETWEEN 'V01' AND 'V89') AS filtrado
        FROM '{tmp_data["silver_sim"]}'
    """).fetchone()
    con.close()
    assert result[0] == result[1], "Silver deve conter apenas registros com CID V01-V89"


def test_silver_sim_enrichment(tmp_data):
    """Silver SIM deve ter campos derivados (tipo_veiculo, faixa_etaria)."""
    con = duckdb.connect(":memory:")
    cols = con.sql(f"SELECT * FROM '{tmp_data['silver_sim']}' LIMIT 1").columns
    con.close()
    assert "tipo_veiculo" in cols
    assert "faixa_etaria" in cols
    assert "sexo_desc" in cols


def test_gold_obitos_aggregation(tmp_data):
    """Gold óbitos (ocorrência) deve ser agregado por município/mês."""
    con = duckdb.connect(":memory:")
    result = con.sql(f"""
        SELECT
            COUNT(DISTINCT cod_mun_ibge) AS municipios,
            MIN(ano) AS min_ano, MAX(ano) AS max_ano
        FROM '{tmp_data["gold_obitos_ocorrencia"]}'
    """).fetchone()
    con.close()
    assert result[0] == 9, "Deve ter 9 municipios"
    assert result[1] == 2022
    assert result[2] == 2023


def test_gold_obitos_residencia_aggregation(tmp_data):
    """Gold óbitos (residencia) deve ser agregado por município/mês."""
    con = duckdb.connect(":memory:")
    result = con.sql(f"""
        SELECT
            COUNT(DISTINCT cod_mun_ibge) AS municipios,
            MIN(ano) AS min_ano, MAX(ano) AS max_ano
        FROM '{tmp_data["gold_obitos_residencia"]}'
    """).fetchone()
    con.close()
    assert result[0] == 9, "Deve ter 9 municipios"
    assert result[1] == 2022
    assert result[2] == 2023


def test_gold_custos_has_financial_data(tmp_data):
    """Gold custos deve ter valores financeiros positivos."""
    con = duckdb.connect(":memory:")
    result = con.sql(f"""
        SELECT SUM(custo_total), SUM(total_procedimentos)
        FROM '{tmp_data["gold_custos"]}'
    """).fetchone()
    con.close()
    assert result[0] > 0, "Custos totais devem ser positivos"
    assert result[1] > 0, "Procedimentos totais devem ser positivos"


def test_pipeline_data_integrity(tmp_data):
    """Bronze → Silver não deve perder registros (todos são V01-V89)."""
    con = duckdb.connect(":memory:")
    bronze_count = con.sql(f"SELECT COUNT(*) FROM '{tmp_data['bronze_sim']}'").fetchone()[0]
    silver_count = con.sql(f"SELECT COUNT(*) FROM '{tmp_data['silver_sim']}'").fetchone()[0]
    con.close()
    assert silver_count == bronze_count
