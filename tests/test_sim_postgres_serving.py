"""Serving SIM-only em PostgreSQL: views no lugar de read_parquet."""

from pathlib import Path

from backend.routers import sim_only


def test_source_for_role_postgres_usa_views_sem_parquet(monkeypatch) -> None:
    monkeypatch.setattr(sim_only, "analytics_uses_postgres", lambda: True)
    assert sim_only._source_for_role("ocorrencia") == "v_sim_obitos_ocorrencia"
    assert sim_only._source_for_role("residencia") == "v_sim_obitos_residencia"


def test_source_for_role_duckdb_nao_inventa_view(monkeypatch) -> None:
    monkeypatch.setattr(sim_only, "analytics_uses_postgres", lambda: False)
    monkeypatch.setattr(
        sim_only,
        "_mart_path",
        lambda role: Path(f"{role}.parquet"),
    )
    source = sim_only._source_for_role("ocorrencia")
    assert source.startswith("read_parquet(")
    assert "v_sim_obitos" not in source


def test_silver_source_postgres_continua_503(monkeypatch) -> None:
    monkeypatch.setattr(sim_only, "analytics_uses_postgres", lambda: True)
    from fastapi import HTTPException

    try:
        sim_only._silver_source()
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "DuckDB" in exc.detail
    else:
        raise AssertionError("Silver em Postgres deveria responder 503")


def test_migracao_003_define_views_sim() -> None:
    sql = (Path(__file__).resolve().parents[1] / "db/migrations/003_sim_marts.sql").read_text(
        encoding="utf-8"
    )
    assert "gold_sim_obitos_ocorrencia" in sql
    assert "gold_sim_obitos_residencia" in sql
    assert "v_sim_obitos_ocorrencia" in sql
    assert "v_sim_obitos_residencia" in sql
    assert "cod_mun_ibge_6" in sql
    assert "geografia_status" in sql
    assert "sexo_desc" in sql
    assert "frota_total" in sql
