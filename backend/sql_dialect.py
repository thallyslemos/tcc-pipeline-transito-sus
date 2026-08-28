"""Fragmentos SQL portáveis entre DuckDB e PostgreSQL."""

from .config import settings


def analytics_uses_postgres() -> bool:
    """True quando a API deve usar SQL compatível com PostgreSQL."""
    return bool(settings.use_postgres and settings.database_url)


def expr_competencia_yyyy_mm(col: str = "competencia") -> str:
    """Expressão para agrupar competência como 'YYYY-MM'."""
    if analytics_uses_postgres():
        return f"TO_CHAR({col}::date, 'YYYY-MM')"
    return f"STRFTIME({col}, '%Y-%m')"


def expr_round_numeric(expr: str, decimals: int = 2) -> str:
    """Expressão ROUND portável para Postgres (não aceita double,2 — exige numeric)."""
    if analytics_uses_postgres():
        return f"ROUND(({expr})::numeric, {decimals})"
    return f"ROUND({expr}, {decimals})"
