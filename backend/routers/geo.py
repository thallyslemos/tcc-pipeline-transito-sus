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
    wa = _where_and(ano=ano, uf=uf, regiao=regiao)

    if metrica == "custos":
        rows = (
            con.sql(f"""
            SELECT LEFT(cod_mun_ibge, 6) AS cod6, municipio, uf,
                   {expr_round_numeric("SUM(custo_total)")} AS valor,
                   SUM(total_atendimentos) AS atendimentos
            FROM v_custos WHERE 1=1 {wa}
            GROUP BY cod6, municipio, uf
        """)
            .fetchdf()
            .to_dict(orient="records")
        )
    else:
        view_obitos = f"v_obitos_{dimensao}"
        if not _has_view(con, view_obitos):
            view_obitos = "v_obitos"
        rows = (
            con.sql(f"""
            SELECT LEFT(cod_mun_ibge, 6) AS cod6, municipio, uf,
                   SUM(total_obitos) AS valor
            FROM {view_obitos} WHERE 1=1 {wa}
            GROUP BY cod6, municipio, uf
        """)
            .fetchdf()
            .to_dict(orient="records")
        )

    rows = _sanitize_floats(rows)
    return {r["cod6"]: r for r in rows}


def _ibge_join(con, table_alias: str = "o") -> str:
    """Retorna cláusula LEFT JOIN com v_ibge_municipios se disponível."""
    if not _has_view(con, "v_ibge_municipios"):
        return ""
    return (
        f"LEFT JOIN v_ibge_municipios ibge "
        f"ON LEFT({table_alias}.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)"
    )


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


def _build_polygon_fc(malhas: dict, metrics: dict) -> dict:
    """Constrói FeatureCollection com polígonos do IBGE + métricas."""
    features = []
    for feat in malhas.get("features", []):
        codarea = feat.get("properties", {}).get("codarea", "")
        cod6 = codarea[:6]
        m = metrics.get(cod6)
        if not m:
            continue

        features.append(
            {
                "type": "Feature",
                "geometry": feat["geometry"],
                "properties": {
                    "cod_mun_ibge": codarea,
                    "municipio": m.get("municipio", ""),
                    "uf": m.get("uf", ""),
                    "valor": m.get("valor", 0),
                    "atendimentos": m.get("atendimentos"),
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
    """Fallback: FeatureCollection de pontos (centroides) quando malhas não existem."""
    con = get_connection()
    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_join(con, "o")
    wa = _where_and(ano=ano, uf=uf, regiao=regiao)

    if metrica == "custos":
        rows = (
            con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   {expr_round_numeric("SUM(o.custo_total)")} AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_custos o {join_ibge}
            WHERE 1=1 {wa}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        """)
            .fetchdf()
            .to_dict(orient="records")
        )
    else:
        view_obitos = f"v_obitos_{dimensao}"
        if not _has_view(con, view_obitos):
            view_obitos = "v_obitos"
        rows = (
            con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   SUM(o.total_obitos) AS valor,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM {view_obitos} o {join_ibge}
            WHERE 1=1 {wa}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        """)
            .fetchdf()
            .to_dict(orient="records")
        )

    rows = _sanitize_floats(rows)
    features = []
    for r in rows:
        lat, lon = r.get("lat"), r.get("lon")
        if not _within_brasil(lat, lon):
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "cod_mun_ibge": r["cod_mun_ibge"],
                    "municipio": r["municipio"],
                    "uf": r["uf"],
                    "valor": r["valor"],
                    "atendimentos": r.get("atendimentos"),
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}
