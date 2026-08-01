"""Testes do contrato Silver SIM v2."""

import importlib
import json
from pathlib import Path

import duckdb

silver_v2 = importlib.import_module("data-pipeline.silver_v2")


def _write_sim(path: Path, *, include_invalid: bool = True) -> None:
    con = duckdb.connect(":memory:")
    try:
        rows = [
            "('V01', '01012024', '405', '2', '292740', '292740', 'BA', '2')",
            "('V02', '02012024', '005', '9', '292740', '292740', 'BA', '2')",
        ]
        if include_invalid:
            rows.append("('X99', 'bad', '900', '1', '000000', '000000', 'BA', '2')")
        sql = """
            CREATE TABLE sim(
                CAUSABAS VARCHAR, DTOBITO VARCHAR, IDADE VARCHAR, SEXO VARCHAR,
                CODMUNRES VARCHAR, CODMUNOCOR VARCHAR, UF VARCHAR, TIPOBITO VARCHAR
            )
        """
        con.sql(sql)
        for row in rows:
            con.sql(f"INSERT INTO sim VALUES {row}")
        con.sql(f"COPY sim TO '{path}' (FORMAT PARQUET)")
    finally:
        con.close()


def _read(path: Path):
    con = duckdb.connect(":memory:")
    try:
        return con.sql(f"SELECT * FROM '{path}' ORDER BY source_row_number").df()
    finally:
        con.close()


def test_silver_v2_preserva_raw_e_nao_mapeia_ignorado_para_feminino(tmp_path: Path):
    bronze = tmp_path / "bronze.parquet"
    silver = tmp_path / "silver_v2.parquet"
    _write_sim(bronze)
    silver_v2.processar_silver_sim_v2(bronze, destino=silver)
    df = _read(silver)

    assert len(df) == 3
    assert set(df["is_v01_v89"]) == {True, False}
    assert df.loc[df["idade_raw"] == "005", "idade_anos"].iloc[0] == 0
    assert df.loc[df["idade_raw"] == "900", "idade_anos"].isna().all()
    assert df.loc[df["sexo_raw"] == "9", "sexo_desc"].iloc[0] == "Ignorado"
    assert not ((df["sexo_raw"] == "9") & (df["sexo_desc"] == "Feminino")).any()
    assert df.loc[df["causabas"] == "X99", "qa_status"].iloc[0] == "review"
    assert df["record_id"].is_unique
    assert (df["cod_mun_ocorrencia"] == "292740").sum() == 2


def test_silver_v2_com_manifesto_ignora_partes_legadas(tmp_path: Path):
    bronze = tmp_path / "parts"
    bronze.mkdir()
    legacy = bronze / "sim_BA_2024_0.parquet"
    approved = bronze / "sim_BA_2024_canonical.parquet"
    _write_sim(legacy, include_invalid=False)
    _write_sim(approved, include_invalid=True)
    manifest = {
        "version": 1,
        "entries": [
            {
                "source_identity": "a" * 64,
                "dataset": "SIM",
                "group": "CID10",
                "uf": "BA",
                "year": 2024,
                "target_path": approved.name,
                "status": "approved",
            }
        ],
    }
    (bronze / "sim_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    silver = tmp_path / "silver_v2.parquet"
    silver_v2.processar_silver_sim_v2(bronze, destino=silver)
    df = _read(silver)
    assert len(df) == 3
    assert all(df["source_file_name"].str.endswith(approved.name))
