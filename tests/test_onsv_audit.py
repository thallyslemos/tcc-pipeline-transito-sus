"""Testes do contrato de reconciliação metodológica com o ONSV."""

from pathlib import Path

import duckdb
import pytest
from backend.services.onsv_audit import build_onsv_audit_report


def _write_sim_parquet(path: Path, rows: list[tuple[str, str, str, str, str]]) -> None:
    con = duckdb.connect(":memory:")
    try:
        con.execute(
            """
            CREATE TABLE sim (
                TIPOBITO VARCHAR,
                DTOBITO VARCHAR,
                CAUSABAS VARCHAR,
                CODMUNOCOR VARCHAR,
                CODMUNRES VARCHAR
            )
            """
        )
        con.executemany("INSERT INTO sim VALUES (?, ?, ?, ?, ?)", rows)
        con.execute("COPY sim TO ? (FORMAT PARQUET)", [str(path)])
    finally:
        con.close()


def test_audit_deduplicates_identical_sim_files(tmp_path: Path):
    rows = [
        ("2", "01012024", "V499", "292000 ", "292100 "),
        ("2", "02012024", "V234", "292000 ", "292100 "),
        ("2", "03012024", "C329", "292000 ", "292100 "),
    ]
    first = tmp_path / "sim_BA_2024_0.parquet"
    duplicate = tmp_path / "sim_BA_2024_1.parquet"
    _write_sim_parquet(first, rows)
    duplicate.write_bytes(first.read_bytes())

    report = build_onsv_audit_report(tmp_path)

    assert report["source"]["files_observed"] == 2
    assert report["source"]["files_canonical"] == 1
    assert report["source"]["duplicate_files_removed"] == 1
    annual = next(row for row in report["annual"] if row["ano"] == 2024)
    assert annual["ocorrencia_brasil_deduplicada"] == 2
    assert annual["ocorrencia_brasil_com_copias"] == 4
    assert annual["excesso_por_copias"] == 2
    assert annual["ocorrencia_ba_deduplicada"] == 2
    assert annual["residencia_ba_deduplicada"] == 2


@pytest.mark.requires_data
@pytest.mark.xfail(
    reason=(
        "auditoria.router nunca foi registrado em backend/app.py desde "
        "7246b22 (feat(api): expose SIM-only evidence contract), que "
        "deliberadamente tornou a comparacao ONSV nao-publica — ver "
        "test_sim_api.py::test_onsv_comparison_is_not_a_public_feature. "
        "Este teste ficou orfao da decisao de produto; manter como xfail "
        "ate decidir se o router/teste devem ser removidos."
    ),
    strict=True,
)
def test_audit_endpoint_reproduces_onsv_anchors(client):
    response = client.get("/api/dashboard/auditoria/onsv-2024")

    assert response.status_code == 200
    payload = response.json()
    anchors = {item["ano"]: item for item in payload["anchors"]}
    assert anchors[2023]["onsv_publicado"] == 34_881
    assert anchors[2023]["local_deduplicado"] == 34_881
    assert anchors[2024]["onsv_publicado"] == 37_150
    assert anchors[2024]["local_deduplicado"] == 37_150
    assert all(item["status"] == "reproduzido_localmente" for item in anchors.values())
