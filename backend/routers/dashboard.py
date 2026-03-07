"""Router para endpoints do dashboard - dados agregados para visualizacao."""

import math

from fastapi import APIRouter, Query

from ..database import get_connection

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _sanitize_floats(rows: list[dict]) -> list[dict]:
    """Substitui float nan por None para serializacao JSON."""
    for r in rows:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
    return rows


def _obitos_has_lat_lon(con) -> bool:
    """Verifica se v_obitos possui colunas lat/lon (Gold enriquecido com IBGE)."""
    cols = [r[0] for r in con.sql("DESCRIBE SELECT * FROM v_obitos").fetchall()]
    return "lat" in cols and "lon" in cols


def _has_view(con, view_name: str) -> bool:
    """Verifica se uma view existe no DuckDB."""
    try:
        con.sql(f"DESCRIBE {view_name}")
        return True
    except Exception:
        return False


def _lat_lon_expr(con, table_alias: str = "o") -> tuple[str, str]:
    """Retorna expressões SQL para lat/lon com fallback para v_ibge_municipios.

    O Gold pode ter lat/lon null (ibge_fetcher não rodou ou código 6 dígitos).
    Nesse caso, faz JOIN com v_ibge_municipios por prefixo de 6 dígitos.
    """
    has_ibge = _has_view(con, "v_ibge_municipios")
    if has_ibge:
        return (
            f"COALESCE({table_alias}.lat, ibge.lat)",
            f"COALESCE({table_alias}.lon, ibge.lon)",
        )
    return (f"{table_alias}.lat", f"{table_alias}.lon")


def _ibge_join(con, table_alias: str = "o") -> str:
    """Retorna cláusula LEFT JOIN com v_ibge_municipios se disponível.

    Faz match por código de 7 dígitos ou prefixo de 6 dígitos,
    tratando a diferença entre DATASUS (6) e IBGE (7).
    """
    if not _has_view(con, "v_ibge_municipios"):
        return ""
    return (
        f"LEFT JOIN v_ibge_municipios ibge "
        f"ON LEFT({table_alias}.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)"
    )


def _where(ano: int | None = None, mun: str | None = None, veiculo: str | None = None) -> str:
    """Monta clausula WHERE dinamica."""
    clauses = []
    if ano is not None:
        clauses.append(f"ano = {ano}")
    if mun:
        clauses.append(f"cod_mun_ibge = '{mun}'")
    if veiculo:
        clauses.append(f"tipo_veiculo = '{veiculo}'")
    return ("WHERE " + " AND ".join(clauses)) if clauses else ""


def _where_and(ano: int | None = None, mun: str | None = None, veiculo: str | None = None) -> str:
    """Monta filtro como AND para queries com WHERE 1=1."""
    clauses = []
    if ano is not None:
        clauses.append(f"AND ano = {ano}")
    if mun:
        clauses.append(f"AND cod_mun_ibge = '{mun}'")
    if veiculo:
        clauses.append(f"AND tipo_veiculo = '{veiculo}'")
    return " ".join(clauses)


@router.get("/summary")
async def dashboard_summary(
    ano: int | None = None,
    municipio: str | None = Query(None, alias="municipio"),
    tipo_veiculo: str | None = Query(None, alias="tipo_veiculo"),
):
    """Resumo geral com KPIs, series temporais e distribuicoes."""
    con = get_connection()
    w = _where(ano, municipio, tipo_veiculo)
    wa = _where_and(ano, municipio, tipo_veiculo)

    total_obitos = con.sql(f"SELECT COALESCE(SUM(total_obitos),0) FROM v_obitos {w}").fetchone()[0]
    total_custos = con.sql(f"SELECT COALESCE(SUM(custo_total),0) FROM v_custos {w}").fetchone()[0]
    total_atend = con.sql(
        f"SELECT COALESCE(SUM(total_atendimentos),0) FROM v_custos {w}"
    ).fetchone()[0]
    n_mun = con.sql(f"SELECT COUNT(DISTINCT cod_mun_ibge) FROM v_obitos {w}").fetchone()[0]

    obitos_ano = (
        con.sql("SELECT ano, SUM(total_obitos) AS total FROM v_obitos GROUP BY ano ORDER BY ano")
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_ano = (
        con.sql(
            "SELECT ano, ROUND(SUM(custo_total),2) AS total FROM v_custos GROUP BY ano ORDER BY ano"
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_tipo = (
        con.sql(f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM v_obitos {w} GROUP BY tipo_veiculo ORDER BY total DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_tipo = (
        con.sql(f"""
        SELECT tipo_veiculo, ROUND(SUM(custo_total),2) AS total
        FROM v_custos {w} GROUP BY tipo_veiculo ORDER BY total DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_mun = (
        con.sql(f"""
        SELECT municipio, SUM(total_obitos) AS total
        FROM v_obitos {w} GROUP BY municipio ORDER BY total DESC
        LIMIT 10
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_mun = (
        con.sql(f"""
        SELECT municipio, ROUND(SUM(custo_total),2) AS total
        FROM v_custos {w} GROUP BY municipio ORDER BY total DESC
        LIMIT 10
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    serie_obitos = (
        con.sql(f"""
        SELECT STRFTIME(competencia,'%Y-%m') AS competencia, SUM(total_obitos) AS valor
        FROM v_obitos WHERE 1=1 {wa} GROUP BY competencia ORDER BY competencia
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    serie_custos = (
        con.sql(f"""
        SELECT STRFTIME(competencia,'%Y-%m') AS competencia, ROUND(SUM(custo_total),2) AS valor
        FROM v_custos WHERE 1=1 {wa} GROUP BY competencia ORDER BY competencia
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_faixa = (
        con.sql(f"""
        SELECT faixa_etaria, SUM(total_obitos) AS total FROM v_obitos {w} GROUP BY faixa_etaria
        ORDER BY CASE faixa_etaria
            WHEN '0-14' THEN 1 WHEN '15-24' THEN 2 WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4 WHEN '45-54' THEN 5 WHEN '55-64' THEN 6 ELSE 7
        END
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_sexo = (
        con.sql(f"""
        SELECT sexo, SUM(total_obitos) AS total FROM v_obitos {w} GROUP BY sexo ORDER BY total DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    partes = []
    if ano is not None:
        partes.append(str(ano))
    if municipio:
        nome_mun = con.sql(
            f"SELECT DISTINCT municipio FROM v_obitos WHERE cod_mun_ibge = '{municipio}' LIMIT 1"
        ).fetchone()
        if nome_mun:
            partes.append(nome_mun[0])
    periodo = " - ".join(partes) if partes else "2019-2023"

    return {
        "total_obitos": int(total_obitos),
        "total_custos": float(total_custos),
        "total_atendimentos": int(total_atend),
        "municipios": int(n_mun),
        "periodo": periodo,
        "obitos_por_ano": obitos_ano,
        "custos_por_ano": custos_ano,
        "obitos_por_tipo_veiculo": obitos_tipo,
        "custos_por_tipo_veiculo": custos_tipo,
        "obitos_por_municipio": obitos_mun,
        "custos_por_municipio": custos_mun,
        "serie_temporal_obitos": serie_obitos,
        "serie_temporal_custos": serie_custos,
        "obitos_por_faixa_etaria": obitos_faixa,
        "obitos_por_sexo": obitos_sexo,
    }


@router.get("/municipios")
async def listar_municipios():
    """Lista todos os municipios com metadados e totais (lat/lon do Gold ou IBGE)."""
    con = get_connection()
    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_join(con, "o")
    rows = (
        con.sql(f"""
        SELECT o.cod_mun_ibge, o.municipio, o.uf,
               SUM(o.total_obitos) AS obitos,
               MAX({lat_expr}) AS lat,
               MAX({lon_expr}) AS lon
        FROM v_obitos o
        {join_ibge}
        GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        ORDER BY obitos DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )
    return {"municipios": _sanitize_floats(rows)}


@router.get("/municipio/{cod_mun}")
async def detalhe_municipio(cod_mun: str, ano: int | None = None):
    """Dados detalhados de um municipio especifico."""
    con = get_connection()
    cod6 = cod_mun[:6]
    wa = f"AND ano = {ano}" if ano is not None else ""
    wc = f"LEFT(cod_mun_ibge, 6) = '{cod6}'"
    wc_alias = f"LEFT(o.cod_mun_ibge, 6) = '{cod6}'"

    nome = con.sql(
        f"SELECT DISTINCT municipio FROM v_obitos WHERE {wc} LIMIT 1"
    ).fetchone()

    total_obitos = con.sql(f"""
        SELECT COALESCE(SUM(total_obitos),0) FROM v_obitos WHERE {wc} {wa}
    """).fetchone()[0]

    total_custos = con.sql(f"""
        SELECT COALESCE(SUM(custo_total),0) FROM v_custos WHERE {wc} {wa}
    """).fetchone()[0]

    total_atend = con.sql(f"""
        SELECT COALESCE(SUM(total_atendimentos),0) FROM v_custos WHERE {wc} {wa}
    """).fetchone()[0]

    serie_obitos = (
        con.sql(f"""
        SELECT STRFTIME(competencia,'%Y-%m') AS competencia, SUM(total_obitos) AS valor
        FROM v_obitos WHERE {wc} {wa} GROUP BY competencia ORDER BY competencia
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    serie_custos = (
        con.sql(f"""
        SELECT STRFTIME(competencia,'%Y-%m') AS competencia, ROUND(SUM(custo_total),2) AS valor
        FROM v_custos WHERE {wc} {wa} GROUP BY competencia ORDER BY competencia
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    por_tipo = (
        con.sql(f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM v_obitos WHERE {wc} {wa} GROUP BY tipo_veiculo ORDER BY total DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    por_faixa = (
        con.sql(f"""
        SELECT faixa_etaria, SUM(total_obitos) AS total
        FROM v_obitos WHERE {wc} {wa} GROUP BY faixa_etaria
        ORDER BY CASE faixa_etaria
            WHEN '0-14' THEN 1 WHEN '15-24' THEN 2 WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4 WHEN '45-54' THEN 5 WHEN '55-64' THEN 6 ELSE 7
        END
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    por_sexo = (
        con.sql(f"""
        SELECT sexo, SUM(total_obitos) AS total
        FROM v_obitos WHERE {wc} {wa} GROUP BY sexo ORDER BY total DESC
    """)
        .fetchdf()
        .to_dict(orient="records")
    )

    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_join(con, "o")
    meta_row = con.sql(
        f"""SELECT o.uf, MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_obitos o
            {join_ibge}
            WHERE {wc_alias}
            GROUP BY o.uf
            LIMIT 1"""
    ).fetchone()
    uf_val = meta_row[0] if meta_row else ""
    lat_val = meta_row[1] if meta_row else None
    lon_val = meta_row[2] if meta_row else None
    if lat_val is not None and isinstance(lat_val, float) and math.isnan(lat_val):
        lat_val = None
    if lon_val is not None and isinstance(lon_val, float) and math.isnan(lon_val):
        lon_val = None

    return {
        "cod_mun_ibge": cod_mun,
        "municipio": nome[0] if nome else cod_mun,
        "uf": uf_val,
        "lat": lat_val,
        "lon": lon_val,
        "total_obitos": int(total_obitos),
        "total_custos": float(total_custos),
        "total_atendimentos": int(total_atend),
        "serie_obitos": serie_obitos,
        "serie_custos": serie_custos,
        "obitos_por_tipo_veiculo": por_tipo,
        "obitos_por_faixa_etaria": por_faixa,
        "obitos_por_sexo": por_sexo,
    }


@router.get("/mapa")
async def dados_mapa(ano: int | None = None, metrica: str = "obitos"):
    """Dados agregados por municipio para visualizacao no mapa."""
    con = get_connection()
    w = f"AND ano = {ano}" if ano is not None else ""
    lat_expr, lon_expr = _lat_lon_expr(con, "o")
    join_ibge = _ibge_join(con, "o")

    if metrica == "custos":
        rows = (
            con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   ROUND(SUM(o.custo_total),2) AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_custos o
            {join_ibge}
            WHERE 1=1 {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
            ORDER BY valor DESC
        """)
            .fetchdf()
            .to_dict(orient="records")
        )
    else:
        rows = (
            con.sql(f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   SUM(o.total_obitos) AS valor,
                   MAX({lat_expr}) AS lat, MAX({lon_expr}) AS lon
            FROM v_obitos o
            {join_ibge}
            WHERE 1=1 {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
            ORDER BY valor DESC
        """)
            .fetchdf()
            .to_dict(orient="records")
        )

    return {"metrica": metrica, "ano": ano, "dados": _sanitize_floats(rows)}


@router.get("/anos")
async def anos_disponiveis():
    """Lista anos disponiveis nos dados."""
    con = get_connection()
    anos = con.sql("SELECT DISTINCT ano FROM v_obitos ORDER BY ano").fetchdf()
    return {"anos": anos["ano"].tolist()}


@router.get("/tipos-veiculo")
async def tipos_veiculo():
    """Lista tipos de veiculo disponiveis."""
    con = get_connection()
    tipos = con.sql("SELECT DISTINCT tipo_veiculo FROM v_obitos ORDER BY tipo_veiculo").fetchdf()
    return {"tipos": tipos["tipo_veiculo"].tolist()}
