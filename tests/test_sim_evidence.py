# ruff: noqa: E501
"""Contratos do mart SIM-only e dos denominadores opcionais."""

from importlib import import_module
from pathlib import Path

import duckdb
import pytest

sim_evidence = import_module("data-pipeline.sim_evidence")


def _write_parquet(path: Path, sql: str) -> None:
    con = duckdb.connect(":memory:")
    try:
        con.sql(sql)
        con.sql(f"COPY sim TO '{path}' (FORMAT PARQUET)")
    finally:
        con.close()


def _silver(path: Path) -> None:
    _write_parquet(
        path,
        """
        CREATE TABLE sim AS SELECT * FROM (VALUES
            ('r1', '2024-01-02'::DATE, '2024-01-01'::TIMESTAMP, 2024, 1, TRUE, '2', 'ok', '292740', '292740', '2927401', '2927401', 'Brumado', 'Brumado', 'BA', 'BA', 'encontrado', 'encontrado', 'Automovel', '25-34', 1, 'Masculino'),
            ('r2', '2024-01-03'::DATE, '2024-01-01'::TIMESTAMP, 2024, 1, TRUE, '2', 'ok', '292740', '292740', '2927401', '2927401', 'Brumado', 'Brumado', 'BA', 'BA', 'encontrado', 'encontrado', 'Pedestre', '55-64', 9, 'Ignorado'),
            ('r3', '2024-01-04'::DATE, '2024-01-01'::TIMESTAMP, 2024, 1, FALSE, '2', 'review', '292740', '292740', '2927401', '2927401', 'Brumado', 'Brumado', 'BA', 'BA', 'encontrado', 'encontrado', 'Pedestre', '15-24', 2, 'Feminino')
        ) AS t(record_id, dt_obito, competencia, ano_obito, mes_obito, is_v01_v89, tipobito_raw, qa_status, cod_mun_ocorrencia_6, cod_mun_residencia_6, cod_mun_ocorrencia_ibge, cod_mun_residencia_ibge, municipio_ocorrencia, municipio_residencia, uf_ocorrencia, uf_residencia, geografia_status_ocorrencia, geografia_status_residencia, tipo_veiculo, faixa_etaria, sexo, sexo_desc);
        """,
    )


def _dimension(path: Path) -> None:
    _write_parquet(
        path,
        """
        CREATE TABLE sim AS SELECT * FROM (VALUES ('2927401', 'Brumado', 'BA')) AS t(cod_mun_ibge, nome, uf);
        """,
    )


def _population(path: Path) -> None:
    _write_parquet(
        path,
        """
        CREATE TABLE sim AS SELECT * FROM (VALUES ('2927401', 2024, 1000)) AS t(cod_mun_ibge, ano, populacao);
        """,
    )


def _fleet(path: Path) -> None:
    _write_parquet(
        path,
        """
        CREATE TABLE sim AS SELECT * FROM (VALUES ('2927401', 2024, 500)) AS t(cod_mun_ibge, ano, frota_total);
        """,
    )


def test_mart_filtra_qa_e_calcula_denominadores(tmp_path: Path):
    silver = tmp_path / "silver.parquet"
    dim = tmp_path / "dim.parquet"
    pop = tmp_path / "pop.parquet"
    fleet = tmp_path / "fleet.parquet"
    out = tmp_path / "mart.parquet"
    _silver(silver)
    _dimension(dim)
    _population(pop)
    _fleet(fleet)

    sim_evidence.materializar_mart_municipal(
        silver, role="ocorrencia", destino=out, municipio_path=dim,
        populacao_path=pop, frota_path=fleet,
    )
    con = duckdb.connect(":memory:")
    row = con.sql(f"SELECT SUM(total_obitos), MIN(taxa_obitos_100mil), MIN(taxa_obitos_10mil_veiculos), COUNT(*) FROM '{out}'").fetchone()
    assert row == (2, 100.0, 20.0, 2)

    res = tmp_path / "mart_res.parquet"
    sim_evidence.materializar_mart_municipal(
        silver, role="residencia", destino=res, municipio_path=dim,
        populacao_path=tmp_path / "missing-pop.parquet",
        frota_path=tmp_path / "missing-fleet.parquet",
    )
    nulls = con.sql(f"SELECT COUNT(*) FROM '{res}' WHERE populacao_status = 'indisponivel' AND taxa_obitos_100mil IS NULL").fetchone()[0]
    assert nulls == 2


def test_mart_nao_sobrescreve_snapshot(tmp_path: Path):
    silver = tmp_path / "silver.parquet"
    out = tmp_path / "mart.parquet"
    _silver(silver)
    out.write_bytes(b"preservar")
    with pytest.raises(FileExistsError):
        sim_evidence.materializar_mart_municipal(silver, role="ocorrencia", destino=out)
    assert out.read_bytes() == b"preservar"


def test_auditoria_registra_granularidade_e_filtro(tmp_path: Path):
    silver = tmp_path / "silver.parquet"
    _silver(silver)
    report = sim_evidence.auditar_snapshot_sim(silver)
    assert report["summary"]["linhas_silver"] == 3
    assert report["summary"]["record_ids_unicos"] == 3
    assert report["summary"]["att_todos"] == 2
    assert report["summary"]["att_analiticos"] == 2
    assert report["validacoes"]["record_id_unico"] is True
    assert report["validacoes"]["att_nao_fetais_consistente"] is True
