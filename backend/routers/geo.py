"""Router para dados geoespaciais — GeoJSON FeatureCollection."""

from fastapi import APIRouter

from ..database import get_connection
from ..routers.dashboard import _ibge_join, _lat_lon_expr, _sanitize_floats

router = APIRouter(prefix="/api/geo", tags=["GeoJSON"])

BRASIL_LAT_RANGE = (-33.8, 5.3)
BRASIL_LON_RANGE = (-73.9, -34.8)


def _within_brasil(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    return (
        BRASIL_LAT_RANGE[0] <= lat <= BRASIL_LAT_RANGE[1]
        and BRASIL_LON_RANGE[0] <= lon <= BRASIL_LON_RANGE[1]
    )


@router.get("/municipios")
async def geojson_municipios(ano: int | None = None, metrica: str = "obitos"):
    """Retorna GeoJSON FeatureCollection com dados agregados por município.

    Cada Feature é um ponto (centroide) com propriedades de óbitos/custos.
    Pontos com lat/lon fora dos limites do Brasil são filtrados.
    """
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
            ORDER BY valor DESC
        """).fetchdf().to_dict(orient="records")
    else:
        rows = con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   SUM(o.total_obitos) AS valor,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_obitos o {join_ibge}
            WHERE 1=1 {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
            ORDER BY valor DESC
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

    return {
        "type": "FeatureCollection",
        "features": features,
    }
