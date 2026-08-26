"""API SIM-only baseada nos marts do contrato de evidencia v1."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..database import get_connection
from .utils import REGIOES

router = APIRouter(prefix="/api/sim", tags=["SIM-only"])
Role = Literal["ocorrencia", "residencia"]

_MARTS: dict[str, str] = {
    "ocorrencia": "sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet",
    "residencia": "sim_v1_obitos_municipio_mes_residencia_v2.parquet",
}

_SILVER_CONTRACT = "data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet"


def _silver_source() -> str:
    """Fonte da Silver contratual v2 para consultas de fluxos residencia-ocorrencia."""
    if settings.use_postgres and settings.database_url:
        raise HTTPException(
            status_code=503,
            detail="A Silver SIM v2 (fluxos/temporal por dia) requer o backend DuckDB nesta fase",
        )
    path = settings.resolve(_SILVER_CONTRACT)
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Silver SIM v2 indisponivel; execute o contrato de evidencia "
                "antes de consultar a API"
            ),
        )
    return f"read_parquet('{str(path).replace(chr(39), chr(39) * 2)}')"


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
    if settings.use_postgres and settings.database_url:
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
    ano_inicio: int | None = None,
    ano_fim: int | None = None,
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
    elif ano_inicio is not None or ano_fim is not None:
        if ano_inicio is not None:
            clauses.append(f"ano >= {ano_inicio}")
        if ano_fim is not None:
            clauses.append(f"ano <= {ano_fim}")
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
    by_month = con.sql(
        f"""
        SELECT strftime(CAST(competencia AS DATE), '%Y-%m') AS competencia,
               SUM(total_obitos) AS total
        FROM {source} WHERE {where}
        GROUP BY competencia ORDER BY competencia
        """
    ).fetchall()
    by_vehicle = con.sql(
        f"""
        SELECT COALESCE(NULLIF(TRIM(tipo_veiculo), ''), 'Ignorado') AS tipo_veiculo,
               SUM(total_obitos) AS total
        FROM {source} WHERE {where}
        GROUP BY 1 ORDER BY total DESC, tipo_veiculo
        """
    ).fetchall()
    by_age = con.sql(
        f"""
        WITH buckets AS (
            SELECT COALESCE(NULLIF(TRIM(faixa_etaria), ''), 'Ignorada') AS faixa_etaria,
                   total_obitos
            FROM {source} WHERE {where}
        )
        SELECT faixa_etaria, SUM(total_obitos) AS total
        FROM buckets
        GROUP BY faixa_etaria
        ORDER BY CASE faixa_etaria
            WHEN '0-14' THEN 1
            WHEN '15-24' THEN 2
            WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4
            WHEN '45-54' THEN 5
            WHEN '55-64' THEN 6
            WHEN '65+' THEN 7
            ELSE 8
        END
        """
    ).fetchall()
    by_sex = con.sql(
        f"""
        SELECT COALESCE(NULLIF(TRIM(sexo_desc), ''), 'Ignorado') AS sexo,
               SUM(total_obitos) AS total
        FROM {source} WHERE {where}
        GROUP BY 1 ORDER BY total DESC, sexo
        """
    ).fetchall()
    if ano is not None:
        with_fleet, total_mun = con.sql(
            f"""
            SELECT COUNT(DISTINCT CASE WHEN frota_total > 0 THEN cod_mun_ibge_6 END),
                   COUNT(DISTINCT cod_mun_ibge_6)
            FROM {source}
            WHERE {where} AND geografia_status = 'encontrado'
            """
        ).fetchone()
        pct = (100.0 * with_fleet / total_mun) if total_mun else 0.0
        frota_label = (
            f"{pct:.1f}% dos municipios com frota SENATRAN no recorte "
            f"(estoque de dezembro/{ano})"
        )
    else:
        frota_label = (
            "informe ano para parear frota SENATRAN de dezembro do mesmo exercicio"
        )
    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "total_obitos": int(total or 0),
        "municipios": int(municipios or 0),
        "periodo": (f"{inicio}-{fim}" if inicio is not None else "sem dados"),
        "obitos_por_ano": [{"ano": int(y), "total": int(n)} for y, n in by_year],
        "obitos_por_mes": [
            {"competencia": str(competencia), "total": int(total_mes)}
            for competencia, total_mes in by_month
        ],
        "obitos_por_tipo_veiculo": [
            {"tipo_veiculo": str(tipo), "total": int(total_tipo)}
            for tipo, total_tipo in by_vehicle
        ],
        "obitos_por_faixa_etaria": [
            {"faixa_etaria": str(faixa), "total": int(total_faixa)}
            for faixa, total_faixa in by_age
        ],
        "obitos_por_sexo": [
            {"sexo": str(sexo), "total": int(total_sexo)}
            for sexo, total_sexo in by_sex
        ],
        "denominadores": {
            "populacao": "disponivel somente quando o municipio/ano existe no IBGE",
            "frota": frota_label,
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
    fleet_expr = "MAX(frota_total)" if ano is not None else "CAST(NULL AS BIGINT)"
    fleet_rate_expr = (
        "CASE WHEN MAX(frota_total) > 0 THEN "
        "SUM(total_obitos) * 10000.0 / MAX(frota_total) ELSE NULL END"
        if ano is not None
        else "CAST(NULL AS DOUBLE)"
    )
    fleet_status_expr = (
        "CASE WHEN MAX(frota_total) > 0 THEN 'disponivel' ELSE 'indisponivel' END"
        if ano is not None
        else "'indisponivel'"
    )
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
               {status_expr} AS populacao_status,
               {fleet_expr} AS frota_total,
               {fleet_rate_expr} AS taxa_obitos_10mil_veiculos,
               {fleet_status_expr} AS frota_status
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
        if row.get("frota_total") is not None:
            row["frota_total"] = int(row["frota_total"])
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
    fleet_expr = "MAX(frota_total)" if ano is not None else "CAST(NULL AS BIGINT)"
    fleet_rate_expr = (
        "CASE WHEN MAX(frota_total) > 0 THEN "
        "SUM(total_obitos) * 10000.0 / MAX(frota_total) ELSE NULL END"
        if ano is not None
        else "CAST(NULL AS DOUBLE)"
    )
    fleet_status_expr = (
        "CASE WHEN MAX(frota_total) > 0 THEN 'disponivel' ELSE 'indisponivel' END"
        if ano is not None
        else "'indisponivel'"
    )
    base = con.sql(
        f"""
        SELECT MAX(cod_mun_ibge) AS cod_mun_ibge, MAX(municipio) AS municipio,
               MAX(uf) AS uf, SUM(total_obitos) AS total_obitos,
               {population_expr} AS populacao,
               {rate_expr} AS taxa_obitos_100mil,
               {status_expr} AS populacao_status,
               {fleet_expr} AS frota_total,
               {fleet_rate_expr} AS taxa_obitos_10mil_veiculos,
               {fleet_status_expr} AS frota_status
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
        "frota_total": int(base[7]) if base[7] is not None else None,
        "taxa_obitos_10mil_veiculos": float(base[8]) if base[8] is not None else None,
        "frota_status": base[9],
        "serie_mensal": [
            {"competencia": str(comp), "obitos": int(obitos)} for comp, obitos in series
        ],
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


# ---------------------------------------------------------------------------
# Fluxos residencia-ocorrencia
# ---------------------------------------------------------------------------

def _fluxos_edges(
    con,
    source: str,
    code: str,
    direcao: str,
    ano: int | None,
    tipo_veiculo: str | None,
    top_n: int,
    min_obitos: int,
    incluir_desconhecidos: bool,
) -> dict | None:
    """Consulta core de fluxos. Retorna None se o municipio nao tem dados."""
    base_where = ["is_v01_v89 = true", "qa_status = 'ok'", "tipobito_raw = '2'"]
    if ano is not None:
        base_where.append(f"ano_obito = {ano}")
    if tipo_veiculo:
        cleaned = _text(tipo_veiculo)
        if cleaned:
            base_where.append(f"tipo_veiculo = '{cleaned}'")

    if direcao == "origens":
        target_col = "cod_mun_ocorrencia_6"
        group_col = "cod_mun_residencia_6"
        mun_col = "municipio_residencia"
        uf_col = "uf_residencia"
        geo_col = "geografia_status_residencia"
        target_mun_col = "municipio_ocorrencia"
        target_uf_col = "uf_ocorrencia"
    else:
        target_col = "cod_mun_residencia_6"
        group_col = "cod_mun_ocorrencia_6"
        mun_col = "municipio_ocorrencia"
        uf_col = "uf_ocorrencia"
        geo_col = "geografia_status_ocorrencia"
        target_mun_col = "municipio_residencia"
        target_uf_col = "uf_residencia"

    base_where.append(f"{target_col} = '{code}'")
    where = " AND ".join(base_where)

    target_row = con.sql(
        f"""
        SELECT MAX({target_mun_col}), MAX({target_uf_col}), COUNT(*)
        FROM {source}
        WHERE {where}
        """
    ).fetchone()

    if target_row is None or int(target_row[2] or 0) == 0:
        return None

    target_municipio = str(target_row[0] or "")
    target_uf = str(target_row[1] or "")
    total_obitos = int(target_row[2])

    # Denominador auditavel: obitos com ambas as geografias encontradas
    ambos_row = con.sql(
        f"""
        SELECT COUNT(*),
               SUM(CASE WHEN {group_col} = '{code}' THEN 1 ELSE 0 END)
        FROM {source}
        WHERE {where}
          AND geografia_status_residencia = 'encontrado'
          AND geografia_status_ocorrencia = 'encontrado'
        """
    ).fetchone()
    total_ambos = int(ambos_row[0] or 0)
    obitos_proprio = int(ambos_row[1] or 0)
    obitos_fora = total_ambos - obitos_proprio

    geo_filter = "" if incluir_desconhecidos else f"AND {geo_col} = 'encontrado'"
    edge_rows = con.sql(
        f"""
        SELECT {group_col},
               MAX({mun_col}),
               MAX({uf_col}),
               MAX({geo_col}),
               COUNT(*) AS obitos
        FROM {source}
        WHERE {where} {geo_filter}
        GROUP BY {group_col}
        HAVING COUNT(*) >= {min_obitos}
        ORDER BY obitos DESC
        LIMIT {top_n}
        """
    ).fetchall()

    arestas = [
        {
            "cod_mun_ibge": str(r[0] or ""),
            "municipio": str(r[1] or "Desconhecido"),
            "uf": str(r[2] or ""),
            "obitos": int(r[4]),
            "participacao": round(int(r[4]) / total_obitos, 4) if total_obitos else 0.0,
            "propria_municipio": str(r[0]) == code,
            "geografia_status": str(r[3] or ""),
        }
        for r in edge_rows
    ]

    municipios_conectados = sum(1 for a in arestas if not a["propria_municipio"])
    proporcao_fora = round(obitos_fora / total_ambos, 4) if total_ambos else 0.0

    return {
        "target_municipio": target_municipio,
        "target_uf": target_uf,
        "total_obitos": total_obitos,
        "total_ambos_encontrados": total_ambos,
        "obitos_proprio_municipio": obitos_proprio,
        "obitos_fora": obitos_fora,
        "proporcao_fora": proporcao_fora,
        "municipios_conectados": municipios_conectados,
        "arestas": arestas,
    }


@router.get("/fluxos/geo")
async def fluxos_geo(
    cod_municipio: str = Query(..., min_length=6, max_length=7),
    direcao: Literal["origens", "destinos"] = Query("origens"),
    ano: int | None = Query(None, ge=1900, le=2100),
    tipo_veiculo: str | None = Query(None, max_length=80),
    top_n: int = Query(20, ge=1, le=200),
    min_obitos: int = Query(1, ge=1),
) -> dict:
    """GeoJSON dos municipios no fluxo (alvo + conectados) com metricas embarcadas.

    Inclui todos os municipios da UF do alvo para contexto geografico, mais
    municipios conectados de outras UFs.
    """
    code = "".join(c for c in cod_municipio if c.isdigit())[:6]
    if len(code) != 6:
        raise HTTPException(status_code=422, detail="cod_municipio deve ter 6 ou 7 digitos")

    malhas = _load_geojson()
    if malhas is None:
        raise HTTPException(status_code=503, detail="malha municipal IBGE indisponivel")

    con = get_connection()
    source = _silver_source()
    result = _fluxos_edges(con, source, code, direcao, ano, tipo_veiculo, top_n, min_obitos, False)
    if result is None:
        raise HTTPException(status_code=404, detail="municipio sem dados no periodo selecionado")

    edges_by_code = {a["cod_mun_ibge"]: a for a in result["arestas"]}
    if code not in edges_by_code:
        edges_by_code[code] = {
            "cod_mun_ibge": code,
            "municipio": result["target_municipio"],
            "uf": result["target_uf"],
            "obitos": 0,
            "participacao": 0.0,
            "propria_municipio": True,
            "geografia_status": "encontrado",
        }

    target_uf = result["target_uf"]
    flow_codes = set(edges_by_code.keys())
    labels = _municipio_labels(con)

    features = []
    for feature in malhas.get("features", []):
        props = feature.get("properties") or {}
        codarea = str(props.get("codarea", ""))
        cod6 = codarea[:6]

        edge = edges_by_code.get(cod6)
        label = labels.get(cod6, {})
        feature_uf = str(
            (edge or {}).get("uf") or label.get("uf") or ""
        )

        in_flow = cod6 in flow_codes
        in_target_uf = feature_uf == target_uf

        if not in_flow and not in_target_uf:
            continue

        if edge:
            features.append(
                {
                    "type": "Feature",
                    "geometry": feature.get("geometry"),
                    "properties": {
                        "cod_mun_ibge": codarea,
                        "municipio": edge.get("municipio") or label.get("municipio") or codarea,
                        "uf": edge.get("uf") or feature_uf,
                        "obitos": int(edge.get("obitos", 0)),
                        "participacao": float(edge.get("participacao", 0.0)),
                        "propria_municipio": bool(edge.get("propria_municipio", False)),
                        "is_alvo": cod6 == code,
                        "has_flow": True,
                    },
                }
            )
        else:
            features.append(
                {
                    "type": "Feature",
                    "geometry": feature.get("geometry"),
                    "properties": {
                        "cod_mun_ibge": codarea,
                        "municipio": label.get("municipio") or codarea,
                        "uf": feature_uf,
                        "obitos": 0,
                        "participacao": 0.0,
                        "propria_municipio": False,
                        "is_alvo": False,
                        "has_flow": False,
                    },
                }
            )

    return {"type": "FeatureCollection", "features": features}


@router.get("/fluxos")
async def fluxos(
    cod_municipio: str = Query(..., min_length=6, max_length=7),
    direcao: Literal["origens", "destinos"] = Query("origens"),
    ano: int | None = Query(None, ge=1900, le=2100),
    tipo_veiculo: str | None = Query(None, max_length=80),
    top_n: int = Query(20, ge=1, le=200),
    min_obitos: int = Query(1, ge=1),
    incluir_desconhecidos: bool = Query(False),
) -> dict:
    """Fluxos residencia-ocorrencia para um municipio alvo.

    direcao='origens': alvo e o municipio de ocorrencia; mostra de onde vem as vitimas.
    direcao='destinos': alvo e o municipio de residencia; mostra para onde vao os residentes.
    """
    code = "".join(c for c in cod_municipio if c.isdigit())[:6]
    if len(code) != 6:
        raise HTTPException(status_code=422, detail="cod_municipio deve ter 6 ou 7 digitos")

    con = get_connection()
    source = _silver_source()
    result = _fluxos_edges(
        con, source, code, direcao, ano, tipo_veiculo, top_n, min_obitos, incluir_desconhecidos
    )
    if result is None:
        raise HTTPException(status_code=404, detail="municipio sem dados no periodo selecionado")

    return {
        "fonte": "SIM",
        "direcao": direcao,
        "municipio_alvo": {
            "cod_mun_ibge": code,
            "municipio": result["target_municipio"],
            "uf": result["target_uf"],
        },
        "total_obitos": result["total_obitos"],
        "total_ambos_encontrados": result["total_ambos_encontrados"],
        "obitos_proprio_municipio": result["obitos_proprio_municipio"],
        "obitos_fora": result["obitos_fora"],
        "proporcao_fora": result["proporcao_fora"],
        "municipios_conectados": result["municipios_conectados"],
        "arestas": result["arestas"],
        "filtros": {
            "ano": ano,
            "tipo_veiculo": tipo_veiculo,
            "top_n": top_n,
            "min_obitos": min_obitos,
            "incluir_desconhecidos": incluir_desconhecidos,
        },
        "notas_metodologicas": (
            f"Filtros cientificos: is_v01_v89=true, qa_status=ok, tipobito_raw=2. "
            f"Direcao: {direcao}. "
            f"Desconhecidos {'incluidos' if incluir_desconhecidos else 'excluidos (padrao)'}. "
            f"top_n={top_n}, min_obitos={min_obitos}. "
            "Denominador de proporcao_fora: obitos com ambas as geografias encontradas."
        ),
    }
