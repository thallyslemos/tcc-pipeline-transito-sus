"""Acesso a dados IBGE via DuckDB (views v_ibge_municipios, v_ibge_populacao).

Quando os Parquets IBGE existem, le das views. Senao faz fallback para
dados embutidos do data-pipeline.ibge (offline-first).
"""

from __future__ import annotations

from importlib import import_module

import structlog

from .database import get_connection

logger = structlog.get_logger(__name__)

_ibge_fallback = None


def _fallback():
    global _ibge_fallback
    if _ibge_fallback is None:
        _ibge_fallback = import_module("data-pipeline.ibge")
    return _ibge_fallback


def get_populacao(cod_mun: str, ano: int) -> int | None:
    """Populacao estimada do municipio no ano (v_ibge_populacao ou fallback)."""
    try:
        con = get_connection()
        row = con.execute(
            "SELECT populacao FROM v_ibge_populacao "
            "WHERE LEFT(cod_mun_ibge, 6) = LEFT(?, 6) AND ano = ? LIMIT 1",
            [cod_mun, ano],
        ).fetchone()
        if row:
            return int(row[0])
    except Exception:
        logger.error("Erro ao buscar populacao do municipio", exc_info=True)
        pass
    return _fallback().get_populacao(cod_mun, ano)


def get_info(cod_mun: str) -> dict | None:
    """Informacoes do municipio (v_ibge_municipios: nome, uf, regiao, lat, lon) ou fallback."""
    try:
        con = get_connection()
        row = con.execute(
            "SELECT nome, uf, regiao, lat, lon "
            "FROM v_ibge_municipios "
            "WHERE LEFT(cod_mun_ibge, 6) = LEFT(?, 6) LIMIT 1",
            [cod_mun],
        ).fetchone()
        if row:
            return {
                "nome": row[0],
                "uf": row[1],
                "regiao": row[2],
                "lat": row[3],
                "lon": row[4],
                "area_km2": None,
                "idh": None,
                "pib_per_capita": None,
            }
    except Exception:
        logger.error("Erro ao buscar informacoes do municipio", exc_info=True)
        pass
    return _fallback().get_info(cod_mun)


def taxa_por_100mil(valor: float, populacao: int) -> float:
    """Calcula taxa por 100 mil habitantes (DATASUS/OMS)."""
    if populacao <= 0:
        return 0.0
    return round((valor / populacao) * 100_000, 2)


def custo_per_capita(custo: float, populacao: int) -> float:
    """Calcula custo per capita."""
    if populacao <= 0:
        return 0.0
    return round(custo / populacao, 2)
