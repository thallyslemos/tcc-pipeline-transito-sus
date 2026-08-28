"""Router para dados geoespaciais — GeoJSON FeatureCollection.

Serve polígonos de municípios (malhas IBGE v4) enriquecidos com métricas
de óbitos/custos do pipeline Gold.
"""

import json
from pathlib import Path

from fastapi import APIRouter, Query

from ..database import get_connection
from ..sql_dialect import expr_round_numeric
from .utils import (
    Regiao,
    _has_view,
    _ibge_label_exprs,
    _ibge_municipios_join,
    _sanitize_floats,
    _where_and,
)

router = APIRouter(prefix="/api/geo", tags=["GeoJSON"])

BRASIL_LAT_RANGE = (-33.8, 5.3)
BRASIL_LON_RANGE = (-73.9, -34.8)

_malhas_cache: dict | None = None


def _load_malhas() -> dict | None:
    """Carrega GeoJSON de malhas do disco (cache em memória)."""
    global _malhas_cache
    if _malhas_cache is not None:
        return _malhas_cache

    project_root = Path(__file__).resolve().parent.parent.parent
    malhas_path = project_root / "data" / "ibge_malhas_municipios.geojson"
    if not malhas_path.exists():
        return None

    with open(malhas_path, encoding="utf-8") as f:
        _malhas_cache = json.load(f)
    return _malhas_cache


def _within_brasil(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    return (
        BRASIL_LAT_RANGE[0] <= lat <= BRASIL_LAT_RANGE[1]
        and BRASIL_LON_RANGE[0] <= lon <= BRASIL_LON_RANGE[1]
    )


def _query_metrics(
    metrica: str,
    ano: int | None = None,
    uf: str | None = None,
    regiao: Regiao | None = None,
    dimensao: str = "ocorrencia",
) -> dict[str, dict]:
    """Consulta métricas agregadas por município, retorna dict cod6 -> props."""
    con = get_connection()
    has_pop = _has_view(con, "v_ibge_populacao")
    join_ibge = _ibge_municipios_join(con, "o")
    uf_filt_geo = "COALESCE(ibge.uf, o.uf)" if join_ibge else None
    wa_o = _where_and(
        ano=ano, uf=uf, regiao=regiao, table_alias="o", uf_expr=uf_filt_geo
    )
    mun_expr, uf_expr = _ibge_label_exprs(con, "o")
    join_pop_custo = """
            LEFT JOIN v_ibge_populacao pop
              ON LEFT(o.cod_mun_ibge, 6) = LEFT(pop.cod_mun_ibge, 6)
             AND o.ano = pop.ano
    """ if has_pop else ""
    join_pop_obitos = """
            LEFT JOIN v_ibge_populacao pop
              ON LEFT(o.cod_mun_ibge, 6) = LEFT(pop.cod_mun_ibge, 6)
             AND o.ano = pop.ano
    """ if has_pop else ""

    if metrica == "custos":
        pop_select = "MAX(pop.populacao) AS populacao"
        per_capita = (
            f"{expr_round_numeric('SUM(o.custo_total) / NULLIF(MAX(pop.populacao), 0)')} "
            "AS custo_per_capita"
            if has_pop
            else "CAST(NULL AS DOUBLE) AS custo_per_capita, CAST(NULL AS BIGINT) AS populacao"
        )
        if has_pop:
            rows = (
                con.sql(f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6, {mun_expr} AS municipio,
                   {uf_expr} AS uf,
                   {expr_round_numeric("SUM(o.custo_total)")} AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   {pop_select},
                   {per_capita}
            FROM v_custos o {join_pop_custo}
            {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """)
                .fetchdf()
                .to_dict(orient="records")
            )
        else:
            rows = (
                con.sql(f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6, {mun_expr} AS municipio, {uf_expr} AS uf,
                   {expr_round_numeric("SUM(o.custo_total)")} AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   CAST(NULL AS DOUBLE) AS custo_per_capita,
                   CAST(NULL AS BIGINT) AS populacao
            FROM v_custos o {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """)
                .fetchdf()
                .to_dict(orient="records")
            )
    else:
        view_obitos = f"v_obitos_{dimensao}"
        if not _has_view(con, view_obitos):
            view_obitos = "v_obitos"
        if has_pop:
            rows = (
                con.sql(f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6, {mun_expr} AS municipio,
                   {uf_expr} AS uf,
                   SUM(o.total_obitos) AS valor,
                   MAX(COALESCE(o.populacao_estimada, pop.populacao)) AS populacao,
                   (SUM(o.total_obitos) * 100000.0 / NULLIF(
                       MAX(COALESCE(o.populacao_estimada, pop.populacao)), 0
                   )) AS taxa_obitos_100mil
            FROM {view_obitos} o {join_pop_obitos}
            {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """)
                .fetchdf()
                .to_dict(orient="records")
            )
        else:
            rows = (
                con.sql(f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6, {mun_expr} AS municipio, {uf_expr} AS uf,
                   SUM(o.total_obitos) AS valor,
                   MAX(o.populacao_estimada) AS populacao,
                   (SUM(o.total_obitos) * 100000.0 / NULLIF(MAX(o.populacao_estimada), 0))
                   AS taxa_obitos_100mil
            FROM {view_obitos} o {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """)
                .fetchdf()
                .to_dict(orient="records")
            )

    rows = _sanitize_floats(rows)
    return {r["cod6"]: r for r in rows}


def _lat_lon_expr(con, table_alias: str = "o") -> tuple[str, str]:
    """Retorna expressões SQL para lat/lon com fallback para v_ibge_municipios."""
    has_ibge = _has_view(con, "v_ibge_municipios")
    if has_ibge:
        return (
            f"COALESCE({table_alias}.lat, ibge.lat)",
            f"COALESCE({table_alias}.lon, ibge.lon)",
        )
    return (f"{table_alias}.lat", f"{table_alias}.lon")


@router.get("/municipios")
async def geojson_municipios(
    ano: int | None = None,
    uf: str | None = Query(None, alias="uf"),
    regiao: Regiao | None = Query(None, alias="regiao"),
    dimensao: str = "ocorrencia",
    metrica: str = "obitos",
):
    """GeoJSON FeatureCollection com polígonos de municípios + métricas.

    Se o arquivo de malhas existe (ibge_malhas_municipios.geojson), retorna
    polígonos enriquecidos. Caso contrário, retorna pontos (centroides).
    """
    metrics = _query_metrics(metrica, ano, uf, regiao, dimensao)
    malhas = _load_malhas()

    if malhas:
        return _build_polygon_fc(malhas, metrics)
    return _build_point_fc(metrica, ano, uf, regiao, dimensao)


def _metric_props_geojson(m: dict) -> dict:
    """Campos opcionais para o front (escala absoluta vs relativa)."""
    props: dict = {
        "valor": m.get("valor", 0),
        "atendimentos": m.get("atendimentos"),
    }
    if m.get("populacao") is not None:
        props["populacao"] = m["populacao"]
    if m.get("taxa_obitos_100mil") is not None:
        props["taxa_obitos_100mil"] = m["taxa_obitos_100mil"]
    if m.get("custo_per_capita") is not None:
        props["custo_per_capita"] = m["custo_per_capita"]
    return props


def _build_polygon_fc(malhas: dict, metrics: dict) -> dict:
    """Constrói FeatureCollection com polígonos do IBGE + métricas."""
    features = []
    for feat in malhas.get("features", []):
        codarea = feat.get("properties", {}).get("codarea", "")
        cod6 = codarea[:6]
        m = metrics.get(cod6)
        if not m:
            continue

        mp = _metric_props_geojson(m)
        features.append(
            {
                "type": "Feature",
                "geometry": feat["geometry"],
                "properties": {
                    "cod_mun_ibge": codarea,
                    "municipio": m.get("municipio", ""),
                    "uf": m.get("uf", ""),
                    **mp,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


def _build_point_fc(
    metrica: str,
    ano: int | None = None,
    uf: str | None = None,
    regiao: Regiao | None = None,
    dimensao: str = "ocorrencia",
) -> dict:
    """Fallback: pontos (centroides) — reutiliza agregados de `_query_metrics`."""
    metrics = _query_metrics(metrica, ano, uf, regiao, dimensao)
    if not metrics:
        return {"type": "FeatureCollection", "features": []}

    con = get_connection()
    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_municipios_join(con, "o")
    uf_filt = "COALESCE(ibge.uf, o.uf)" if join_ibge else None
    wa_o = _where_and(ano=ano, uf=uf, regiao=regiao, table_alias="o", uf_expr=uf_filt)

    if metrica == "custos":
        pos_sql = f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6,
                   MAX(o.cod_mun_ibge) AS cod_mun_ibge,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_custos o {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """
    else:
        view_obitos = f"v_obitos_{dimensao}"
        if not _has_view(con, view_obitos):
            view_obitos = "v_obitos"
        pos_sql = f"""
            SELECT LEFT(o.cod_mun_ibge, 6) AS cod6,
                   MAX(o.cod_mun_ibge) AS cod_mun_ibge,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM {view_obitos} o {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY LEFT(o.cod_mun_ibge, 6)
        """

    rows_pos = con.sql(pos_sql).fetchdf().to_dict(orient="records")
    rows_pos = _sanitize_floats(rows_pos)

    features = []
    for r in rows_pos:
        cod6 = r.get("cod6")
        m = metrics.get(cod6) if cod6 else None
        if not m:
            continue
        lat, lon = r.get("lat"), r.get("lon")
        if not _within_brasil(lat, lon):
            continue
        mp = _metric_props_geojson(m)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "cod_mun_ibge": r.get("cod_mun_ibge"),
                    "municipio": m.get("municipio", ""),
                    "uf": m.get("uf", ""),
                    **mp,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}
