"""API SIM-only baseada nos marts do contrato de evidencia v1."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..analytics_backend import AnalyticsBackend
from ..config import settings
from ..database import get_active_backend, get_connection
from .utils import REGIOES

router = APIRouter(prefix="/api/sim", tags=["SIM-only"])
Role = Literal["ocorrencia", "residencia"]

_MARTS: dict[str, str] = {
    "ocorrencia": "sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet",
    "residencia": "sim_v1_obitos_municipio_mes_residencia_v2.parquet",
}


def _mart_path(role: Role) -> Path:
    if role not in _MARTS:
        raise HTTPException(status_code=422, detail="dimensao deve ser ocorrencia ou residencia")
    path = settings.resolve(settings.gold_dir) / _MARTS[role]
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Mart SIM-only indisponivel; execute o contrato de evidencia "
                "antes de consultar a API"
            ),
        )
    return path


def _source(path: Path) -> str:
    if get_active_backend() != AnalyticsBackend.duckdb_local:
        raise HTTPException(
            status_code=503,
            detail="O contrato SIM-only local requer o backend DuckDB nesta fase",
        )
    return f"read_parquet('{str(path).replace(chr(39), chr(39) * 2)}')"


_MUNICIPIO_LABELS: dict[str, dict[str, str]] | None = None


def _municipio_labels(con) -> dict[str, dict[str, str]]:
    """Carrega nomes e UFs canonicos para preencher municipios sem obitos."""
    global _MUNICIPIO_LABELS
    if _MUNICIPIO_LABELS is not None:
        return _MUNICIPIO_LABELS
    try:
        rows = con.sql(
            """
            SELECT LEFT(CAST(cod_mun_ibge AS VARCHAR), 6) AS cod6,
                   MAX(nome) AS municipio,
                   MAX(uf) AS uf
            FROM v_ibge_municipios
            GROUP BY 1
            """
        ).fetchall()
    except Exception:
        _MUNICIPIO_LABELS = {}
        return _MUNICIPIO_LABELS
    _MUNICIPIO_LABELS = {
        str(cod6): {
            "municipio": str(municipio or ""),
            "uf": str(uf or ""),
        }
        for cod6, municipio, uf in rows
    }
    return _MUNICIPIO_LABELS


def _text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned.replace("'", "''") or None


def _role(dimensao: Role) -> Role:
    return dimensao


def _where_clauses(
    *,
    ano: int | None = None,
    uf: str | None = None,
    regiao: str | None = None,
    tipo_veiculo: str | None = None,
    require_geografia: bool = False,
) -> list[str]:
    """Monta filtros SQL controlados para consultas do mart SIM."""
    clauses = ["1=1"]
    if require_geografia:
        clauses.append("geografia_status = 'encontrado'")
    if ano is not None:
        clauses.append(f"ano = {ano}")
    if uf:
        clauses.append(f"uf = '{_text(uf.upper())}'")
    if regiao:
        if regiao not in REGIOES:
            raise HTTPException(status_code=422, detail="regiao invalida")
        ufs = ", ".join(f"'{state}'" for state in REGIOES[regiao])
        clauses.append(f"uf IN ({ufs})")
    if tipo_veiculo:
        cleaned = _text(tipo_veiculo)
        if cleaned:
            clauses.append(f"tipo_veiculo = '{cleaned}'")
    return clauses


@router.get("/metadata")
async def metadata() -> dict:
    """Catalogo de fontes, cobertura, grao, hashes e qualidade."""
    path = settings.resolve("docs/metadata/catalogo_dados.json")
    if not path.exists():
        raise HTTPException(status_code=503, detail="Catalogo de dados indisponivel")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/anos")
async def anos(dimensao: Role = Query("ocorrencia")) -> dict:
    path = _mart_path(_role(dimensao))
    con = get_connection()
    rows = con.sql(f"SELECT DISTINCT ano FROM {_source(path)} ORDER BY ano").fetchall()
    return {"dimensao": dimensao, "anos": [int(row[0]) for row in rows]}


@router.get("/tipos-veiculo")
async def tipos_veiculo(dimensao: Role = Query("ocorrencia")) -> dict:
    path = _mart_path(_role(dimensao))
    con = get_connection()
    rows = con.sql(
        f"""
        SELECT DISTINCT tipo_veiculo
        FROM {_source(path)}
        WHERE tipo_veiculo IS NOT NULL
        ORDER BY 1
        """
    ).fetchall()
    return {"dimensao": dimensao, "tipos": [str(row[0]) for row in rows]}


@router.get("/summary")
async def summary(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    tipo_veiculo: str | None = Query(None, max_length=80),
) -> dict:
    path = _mart_path(_role(dimensao))
    con = get_connection()
    where = " AND ".join(_where_clauses(ano=ano, uf=uf, regiao=regiao, tipo_veiculo=tipo_veiculo))
    source = _source(path)
    total, municipios, inicio, fim = con.sql(
        f"""
        SELECT COALESCE(SUM(total_obitos), 0),
               COUNT(DISTINCT CASE WHEN geografia_status = 'encontrado' THEN cod_mun_ibge_6 END),
               MIN(ano), MAX(ano)
        FROM {source} WHERE {where}
        """
    ).fetchone()
    by_year = con.sql(
        f"""
        SELECT ano, SUM(total_obitos) AS total
        FROM {source} WHERE {where}
        GROUP BY ano ORDER BY ano
        """
    ).fetchall()
    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "total_obitos": int(total or 0),
        "municipios": int(municipios or 0),
        "periodo": (f"{inicio}-{fim}" if inicio is not None else "sem dados"),
        "obitos_por_ano": [{"ano": int(y), "total": int(n)} for y, n in by_year],
        "denominadores": {
            "populacao": "disponivel somente quando o municipio/ano existe no IBGE",
            "frota": "indisponivel ate validacao do SENATRAN",
        },
    }


@router.get("/municipios")
async def municipios(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    tipo_veiculo: str | None = Query(None, max_length=80),
    search: str | None = Query(None, max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    path = _mart_path(_role(dimensao))
    con = get_connection()
    source = _source(path)
    clauses = _where_clauses(
        ano=ano,
        uf=uf,
        regiao=regiao,
        tipo_veiculo=tipo_veiculo,
        require_geografia=True,
    )
    if search:
        term = _text(search)
        clauses.append(
            f"(LOWER(municipio) LIKE LOWER('%{term}%') OR cod_mun_ibge_6 LIKE '%{term}%')"
        )
    where = " AND ".join(clauses)
    offset = (page - 1) * page_size
    population_expr = "MAX(populacao_estimada)" if ano is not None else "CAST(NULL AS BIGINT)"
    rate_expr = (
        "CASE WHEN MAX(populacao_estimada) > 0 THEN "
        "SUM(total_obitos) * 100000.0 / MAX(populacao_estimada) ELSE NULL END"
        if ano is not None
        else "CAST(NULL AS DOUBLE)"
    )
    status_expr = "MAX(populacao_status)" if ano is not None else "'indisponivel'"
    total = con.sql(
        f"""
        SELECT COUNT(*)
        FROM (
            SELECT cod_mun_ibge_6
            FROM {source}
            WHERE {where}
            GROUP BY cod_mun_ibge_6
        )
        """
    ).fetchone()[0]
    rows = (
        con.sql(
            f"""
        SELECT cod_mun_ibge, cod_mun_ibge_6, municipio, uf,
               SUM(total_obitos) AS obitos,
               {population_expr} AS populacao,
               {rate_expr} AS taxa_obitos_100mil,
               {status_expr} AS populacao_status
        FROM {source}
        WHERE {where}
        GROUP BY cod_mun_ibge, cod_mun_ibge_6, municipio, uf
        ORDER BY obitos DESC, municipio
        LIMIT {page_size} OFFSET {offset}
        """
        )
        .fetchdf()
        .to_dict(orient="records")
    )
    for row in rows:
        row["obitos"] = int(row["obitos"] or 0)
        if row.get("populacao") is not None:
            row["populacao"] = int(row["populacao"])
    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "page": page,
        "page_size": page_size,
        "total": int(total),
        "municipios": rows,
    }


@router.get("/municipio/{cod_mun_ibge}")
async def municipio(
    cod_mun_ibge: str,
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    tipo_veiculo: str | None = Query(None, max_length=80),
) -> dict:
    code = "".join(char for char in cod_mun_ibge if char.isdigit())[:6]
    if len(code) != 6:
        raise HTTPException(status_code=422, detail="codigo IBGE deve ter seis ou sete digitos")
    path = _mart_path(_role(dimensao))
    con = get_connection()
    source = _source(path)
    where = f"cod_mun_ibge_6 = '{code}'"
    if ano is not None:
        where += f" AND ano = {ano}"
    if tipo_veiculo:
        cleaned = _text(tipo_veiculo)
        if cleaned:
            where += f" AND tipo_veiculo = '{cleaned}'"
    population_expr = "MAX(populacao_estimada)" if ano is not None else "CAST(NULL AS BIGINT)"
    rate_expr = (
        "CASE WHEN MAX(populacao_estimada) > 0 THEN "
        "SUM(total_obitos) * 100000.0 / MAX(populacao_estimada) ELSE NULL END"
        if ano is not None
        else "CAST(NULL AS DOUBLE)"
    )
    status_expr = "MAX(populacao_status)" if ano is not None else "'indisponivel'"
    base = con.sql(
        f"""
        SELECT MAX(cod_mun_ibge) AS cod_mun_ibge, MAX(municipio) AS municipio,
               MAX(uf) AS uf, SUM(total_obitos) AS total_obitos,
               {population_expr} AS populacao,
               {rate_expr} AS taxa_obitos_100mil,
               {status_expr} AS populacao_status
        FROM {source} WHERE {where}
        """
    ).fetchone()
    if base[0] is None:
        raise HTTPException(status_code=404, detail="municipio sem dados no mart selecionado")
    series = con.sql(
        f"""SELECT competencia, SUM(total_obitos) AS obitos
        FROM {source} WHERE {where} GROUP BY competencia ORDER BY competencia"""
    ).fetchall()
    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "cod_mun_ibge": str(base[0]),
        "municipio": base[1],
        "uf": base[2],
        "total_obitos": int(base[3] or 0),
        "populacao": int(base[4]) if base[4] is not None else None,
        "taxa_obitos_100mil": float(base[5]) if base[5] is not None else None,
        "populacao_status": base[6],
        "serie_mensal": [
            {"competencia": str(comp), "obitos": int(obitos)} for comp, obitos in series
        ],
        "frota_status": "indisponivel",
    }


_GEOJSON_CACHE: dict | None = None


def _load_geojson() -> dict | None:
    global _GEOJSON_CACHE
    if _GEOJSON_CACHE is not None:
        return _GEOJSON_CACHE
    path = settings.resolve("data/ibge_malhas_municipios.geojson")
    if not path.exists():
        return None
    _GEOJSON_CACHE = json.loads(path.read_text(encoding="utf-8"))
    return _GEOJSON_CACHE


@router.get("/geo")
async def geo(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    tipo_veiculo: str | None = Query(None, max_length=80),
) -> dict:
    """GeoJSON dos municipios com metricas agregadas exclusivamente do SIM."""
    malhas = _load_geojson()
    if malhas is None:
        raise HTTPException(status_code=503, detail="malha municipal IBGE indisponivel")
    path = _mart_path(_role(dimensao))
    con = get_connection()
    where = " AND ".join(
        _where_clauses(
            ano=ano,
            uf=uf,
            regiao=regiao,
            tipo_veiculo=tipo_veiculo,
            require_geografia=True,
        )
    )
    source = _source(path)
    if ano is None:
        population = "CAST(NULL AS BIGINT)"
        rate = "CAST(NULL AS DOUBLE)"
        vehicle_rate = "CAST(NULL AS DOUBLE)"
        fleet_status = "'indisponivel'"
    else:
        population = "MAX(populacao_estimada)"
        rate = (
            "CASE WHEN MAX(populacao_estimada) > 0 THEN "
            "SUM(total_obitos) * 100000.0 / MAX(populacao_estimada) ELSE NULL END"
        )
        vehicle_rate = (
            "CASE WHEN MAX(frota_total) > 0 THEN "
            "SUM(total_obitos) * 10000.0 / MAX(frota_total) ELSE NULL END"
        )
        fleet_status = "CASE WHEN MAX(frota_total) > 0 THEN 'disponivel' ELSE 'indisponivel' END"
    rows = (
        con.sql(
            f"""
        SELECT cod_mun_ibge_6 AS cod6, MAX(cod_mun_ibge) AS cod_mun_ibge,
               MAX(municipio) AS municipio, MAX(uf) AS uf,
               SUM(total_obitos) AS valor,
               {population} AS populacao, {rate} AS taxa_obitos_100mil,
               MAX(frota_total) AS frota_total,
               {fleet_status} AS frota_status,
               {vehicle_rate} AS taxa_obitos_10mil_veiculos
        FROM {source}
        WHERE {where}
        GROUP BY cod_mun_ibge_6
        """
        )
        .fetchdf()
        .to_dict(orient="records")
    )
    metrics = {str(row["cod6"]): row for row in rows}
    labels = _municipio_labels(con)
    requested_uf = uf.upper() if uf else None
    features = []
    for feature in malhas.get("features", []):
        props = feature.get("properties") or {}
        codarea = str(props.get("codarea", ""))
        cod6 = codarea[:6]
        metric = metrics.get(cod6)
        label = labels.get(cod6, {})
        feature_uf = str((metric or {}).get("uf") or label.get("uf") or "")
        if requested_uf and feature_uf != requested_uf:
            continue
        if regiao and feature_uf not in REGIOES[regiao]:
            continue
        metric = metric or {}
        features.append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": {
                    "cod_mun_ibge": codarea,
                    "municipio": metric.get("municipio") or label.get("municipio") or codarea,
                    "uf": feature_uf,
                    "valor": int(metric.get("valor") or 0),
                    "has_data": bool(metric),
                    "populacao": int(metric["populacao"])
                    if metric.get("populacao") is not None
                    else None,
                    "taxa_obitos_100mil": float(metric["taxa_obitos_100mil"])
                    if metric.get("taxa_obitos_100mil") is not None
                    else None,
                    "frota_total": int(metric["frota_total"])
                    if metric.get("frota_total") is not None
                    else None,
                    "frota_status": metric.get("frota_status", "indisponivel"),
                    "taxa_obitos_10mil_veiculos": float(metric["taxa_obitos_10mil_veiculos"])
                    if metric.get("taxa_obitos_10mil_veiculos") is not None
                    else None,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}
