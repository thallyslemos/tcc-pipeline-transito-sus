"""Router para dados geoespaciais — GeoJSON FeatureCollection.

Serve polígonos de municípios (malhas IBGE v4) enriquecidos com métricas
de óbitos/custos do pipeline Gold.
"""

import json
from pathlib import Path

from fastapi import APIRouter

from ..database import get_connection
from ..routers.dashboard import _ibge_join, _lat_lon_expr, _sanitize_floats

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


def _query_metrics(metrica: str, ano: int | None) -> dict[str, dict]:
    """Consulta métricas agregadas por município, retorna dict cod6 -> props."""
    con = get_connection()
    w = f"AND ano = {ano}" if ano is not None else ""

    if metrica == "custos":
        rows = con.sql(f"""
            SELECT LEFT(cod_mun_ibge, 6) AS cod6, municipio, uf,
                   ROUND(SUM(custo_total), 2) AS valor,
                   SUM(total_atendimentos) AS atendimentos
            FROM v_custos WHERE 1=1 {w}
            GROUP BY cod6, municipio, uf
        """).fetchdf().to_dict(orient="records")
    else:
        rows = con.sql(f"""
            SELECT LEFT(cod_mun_ibge, 6) AS cod6, municipio, uf,
                   SUM(total_obitos) AS valor
            FROM v_obitos WHERE 1=1 {w}
            GROUP BY cod6, municipio, uf
        """).fetchdf().to_dict(orient="records")

    rows = _sanitize_floats(rows)
    return {r["cod6"]: r for r in rows}


@router.get("/municipios")
async def geojson_municipios(ano: int | None = None, metrica: str = "obitos"):
    """GeoJSON FeatureCollection com polígonos de municípios + métricas.

    Se o arquivo de malhas existe (ibge_malhas_municipios.geojson), retorna
    polígonos enriquecidos. Caso contrário, retorna pontos (centroides).
    """
    metrics = _query_metrics(metrica, ano)
    malhas = _load_malhas()

    if malhas:
        return _build_polygon_fc(malhas, metrics, metrica)
    return _build_point_fc(metrics, metrica, ano)


def _build_polygon_fc(malhas: dict, metrics: dict, metrica: str) -> dict:
    """Constrói FeatureCollection com polígonos do IBGE + métricas."""
    features = []
    for feat in malhas.get("features", []):
        codarea = feat.get("properties", {}).get("codarea", "")
        cod6 = codarea[:6]
        m = metrics.get(cod6)
        if not m:
            continue

        features.append({
            "type": "Feature",
            "geometry": feat["geometry"],
            "properties": {
                "cod_mun_ibge": codarea,
                "municipio": m.get("municipio", ""),
                "uf": m.get("uf", ""),
                "valor": m.get("valor", 0),
                "atendimentos": m.get("atendimentos"),
            },
        })

    return {"type": "FeatureCollection", "features": features}


def _build_point_fc(metrics: dict, metrica: str, ano: int | None) -> dict:
    """Fallback: FeatureCollection de pontos (centroides) quando malhas não existem."""
    con = get_connection()
    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_join(con, "o")
    w = f"AND ano = {ano}" if ano is not None else ""

    if metrica == "custos":
        rows = con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   ROUND(SUM(o.custo_total), 2) AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_custos o {join_ibge}
            WHERE 1=1 {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        """).fetchdf().to_dict(orient="records")
    else:
        rows = con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   SUM(o.total_obitos) AS valor,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_obitos o {join_ibge}
            WHERE 1=1 {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        """).fetchdf().to_dict(orient="records")

    rows = _sanitize_floats(rows)
    features = []
    for r in rows:
        lat, lon = r.get("lat"), r.get("lon")
        if not _within_brasil(lat, lon):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "cod_mun_ibge": r["cod_mun_ibge"],
                "municipio": r["municipio"],
                "uf": r["uf"],
                "valor": r["valor"],
                "atendimentos": r.get("atendimentos"),
            },
        })

    return {"type": "FeatureCollection", "features": features}
