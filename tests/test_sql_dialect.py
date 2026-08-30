"""Expressões SQL portáveis DuckDB vs PostgreSQL."""

from backend import sql_dialect


def test_expr_competencia_duckdb_usa_strftime(monkeypatch) -> None:
    monkeypatch.setattr(sql_dialect, "analytics_uses_postgres", lambda: False)
    expr = sql_dialect.expr_competencia_yyyy_mm("competencia")
    assert "STRFTIME" in expr
    assert "TO_CHAR" not in expr


def test_expr_competencia_postgres_usa_to_char(monkeypatch) -> None:
    monkeypatch.setattr(sql_dialect, "analytics_uses_postgres", lambda: True)
    expr = sql_dialect.expr_competencia_yyyy_mm("competencia")
    assert "TO_CHAR" in expr
    assert "YYYY-MM" in expr


def test_expr_null_double_duckdb(monkeypatch) -> None:
    monkeypatch.setattr(sql_dialect, "analytics_uses_postgres", lambda: False)
    assert sql_dialect.expr_null_double() == "CAST(NULL AS DOUBLE)"


def test_expr_null_double_postgres(monkeypatch) -> None:
    monkeypatch.setattr(sql_dialect, "analytics_uses_postgres", lambda: True)
    assert sql_dialect.expr_null_double() == "CAST(NULL AS DOUBLE PRECISION)"


def test_expr_round_numeric_postgres_cast(monkeypatch) -> None:
    monkeypatch.setattr(sql_dialect, "analytics_uses_postgres", lambda: True)
    expr = sql_dialect.expr_round_numeric("SUM(total_obitos)", 2)
    assert "::numeric" in expr
