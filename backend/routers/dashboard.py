"""Router para endpoints do dashboard - dados agregados para visualizacao."""

from fastapi import APIRouter, Query

from ..database import get_connection
from ..sql_dialect import expr_competencia_yyyy_mm, expr_round_numeric
from .utils import (
    Dimensao,
    Regiao,
    _has_view,
    _ibge_label_exprs,
    _ibge_municipios_join,
    _sanitize_floats,
    _where,
    _where_and,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
async def dashboard_summary(
    ano: int | None = None,
    municipio: str | None = Query(None, alias="municipio"),
    uf: str | None = Query(None, alias="uf"),
    regiao: Regiao | None = Query(None, alias="regiao"),
    tipo_veiculo: str | None = Query(None, alias="tipo_veiculo"),
    dimensao: Dimensao = Query(Dimensao.ocorrencia, alias="dimensao"),
):
    """Resumo geral com KPIs, series temporais e distribuicoes."""
    con = get_connection()
    comp_expr = expr_competencia_yyyy_mm("competencia")

    view_obitos = f"v_obitos_{dimensao.value}"
    if not _has_view(con, view_obitos):
        view_obitos = "v_obitos"  # Fallback para a view padrão

    w = _where(ano, municipio, tipo_veiculo, uf, regiao)
    wa = _where_and(ano, municipio, tipo_veiculo, uf, regiao)

    total_obitos = con.sql(
        f"SELECT COALESCE(SUM(total_obitos),0) FROM {view_obitos} {w}"
    ).fetchone()[0]
    total_custos = con.sql(f"SELECT COALESCE(SUM(custo_total),0) FROM v_custos {w}").fetchone()[0]
    total_atend = con.sql(
        f"SELECT COALESCE(SUM(total_atendimentos),0) FROM v_custos {w}"
    ).fetchone()[0]
    n_mun = con.sql(f"SELECT COUNT(DISTINCT cod_mun_ibge) FROM {view_obitos} {w}").fetchone()[0]

    obitos_ano = (
        con.sql(
            f"SELECT ano, SUM(total_obitos) AS total FROM {view_obitos} GROUP BY ano ORDER BY ano"
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_ano_q = (
        f"SELECT ano, {expr_round_numeric('SUM(custo_total)')} AS total "
        "FROM v_custos GROUP BY ano ORDER BY ano"
    )
    custos_ano = con.sql(custos_ano_q).fetchdf().to_dict(orient="records")

    obitos_tipo = (
        con.sql(
            f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM {view_obitos} {w} GROUP BY tipo_veiculo ORDER BY total DESC
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_tipo = (
        con.sql(
            f"""
        SELECT tipo_veiculo, {expr_round_numeric("SUM(custo_total)")} AS total
        FROM v_custos {w} GROUP BY tipo_veiculo ORDER BY total DESC
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_mun = (
        con.sql(
            f"""
        SELECT municipio, SUM(total_obitos) AS total
        FROM {view_obitos} {w} GROUP BY municipio ORDER BY total DESC
        LIMIT 10
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    custos_mun = (
        con.sql(
            f"""
        SELECT municipio, {expr_round_numeric("SUM(custo_total)")} AS total
        FROM v_custos {w} GROUP BY municipio ORDER BY total DESC
        LIMIT 10
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    serie_obitos = (
        con.sql(
            f"""
        SELECT {comp_expr} AS competencia, SUM(total_obitos) AS valor
        FROM {view_obitos} WHERE 1=1 {wa} GROUP BY competencia ORDER BY competencia
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    serie_custos = (
        con.sql(
            f"""
        SELECT {comp_expr} AS competencia, {expr_round_numeric("SUM(custo_total)")} AS valor
        FROM v_custos WHERE 1=1 {wa} GROUP BY competencia ORDER BY competencia
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_faixa = (
        con.sql(
            f"""
        SELECT faixa_etaria, SUM(total_obitos) AS total FROM {view_obitos} {w} GROUP BY faixa_etaria
        ORDER BY CASE faixa_etaria
            WHEN '0-14' THEN 1 WHEN '15-24' THEN 2 WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4 WHEN '45-54' THEN 5 WHEN '55-64' THEN 6 ELSE 7
        END
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_sexo = (
        con.sql(
            f"""
        SELECT sexo, SUM(total_obitos) AS total
        FROM {view_obitos} {w}
        GROUP BY sexo
        ORDER BY total DESC
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    partes = []
    if regiao:
        partes.append(f"Região {regiao.value}")
    if uf:
        partes.append(uf)
    if municipio:
        nome_mun_row = con.sql(
            f"""
            SELECT DISTINCT municipio
            FROM {view_obitos}
            WHERE cod_mun_ibge = '{municipio}'
            LIMIT 1
            """
        ).fetchone()
        if nome_mun_row:
            partes.append(nome_mun_row[0])

    periodo_loc = ", ".join(partes) or "Brasil"
    periodo_ano = f" - {ano}" if ano else ""
    periodo = f"{periodo_loc}{periodo_ano}"

    return {
        "dimensao_ativa": dimensao.value,
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


# Funções restantes (listar_municipios, etc.) precisam ser atualizadas
# para também aceitarem os novos filtros e a dimensão.
# No momento, elas continuarão usando a view padrão `v_obitos` (ocorrencia).


@router.get("/municipios")
async def listar_municipios(
    uf: str | None = Query(None, alias="uf"),
    regiao: Regiao | None = Query(None, alias="regiao"),
    dimensao: Dimensao = Query(Dimensao.ocorrencia, alias="dimensao"),
):
    """Lista todos os municipios com metadados e totais, com filtros opcionais."""
    con = get_connection()

    view_obitos = f"v_obitos_{dimensao.value}"
    if not _has_view(con, view_obitos):
        view_obitos = "v_obitos"

    w = _where(uf=uf, regiao=regiao)

    # Nota: A junção com dados do IBGE para lat/lon foi movida para geo.py
    # para simplificar este endpoint, que foca na listagem.
    rows = (
        con.sql(
            f"""
        SELECT o.cod_mun_ibge, o.municipio, o.uf,
               SUM(o.total_obitos) AS obitos,
               MAX(o.lat) AS lat,
               MAX(o.lon) AS lon
        FROM {view_obitos} o
        {w}
        GROUP BY o.cod_mun_ibge, o.municipio, o.uf
        ORDER BY obitos DESC
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )
    return {"municipios": _sanitize_floats(rows)}


@router.get("/municipio/{cod_mun}")
async def detalhe_municipio(
    cod_mun: str,
    ano: int | None = None,
    dimensao: Dimensao = Query(Dimensao.ocorrencia, alias="dimensao"),
):
    """Detalhe de um municipio especifico com series temporais."""
    con = get_connection()
    cod6 = cod_mun[:6]
    wa = f"AND ano = {ano}" if ano is not None else ""
    wc = f"LEFT(cod_mun_ibge, 6) = '{cod6}'"
    comp_expr = expr_competencia_yyyy_mm("competencia")

    view_obitos = f"v_obitos_{dimensao.value}"
    if not _has_view(con, view_obitos):
        view_obitos = "v_obitos"

    nome = con.sql(f"SELECT DISTINCT municipio FROM {view_obitos} WHERE {wc} LIMIT 1").fetchone()

    total_obitos = con.sql(
        f"SELECT COALESCE(SUM(total_obitos),0) FROM {view_obitos} WHERE {wc} {wa}"
    ).fetchone()[0]

    total_custos = con.sql(
        f"SELECT COALESCE(SUM(custo_total),0) FROM v_custos WHERE {wc} {wa}"
    ).fetchone()[0]

    total_atend = con.sql(
        f"SELECT COALESCE(SUM(total_atendimentos),0) FROM v_custos WHERE {wc} {wa}"
    ).fetchone()[0]

    serie_obitos = (
        con.sql(
            f"""
        SELECT {comp_expr} AS competencia, SUM(total_obitos) AS valor
        FROM {view_obitos} WHERE {wc} {wa} GROUP BY competencia ORDER BY competencia
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    obitos_tipo = (
        con.sql(
            f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM {view_obitos} WHERE {wc} {wa} GROUP BY tipo_veiculo ORDER BY total DESC
    """
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    return {
        "cod_mun_ibge": cod_mun,
        "municipio": nome[0] if nome else cod_mun,
        "dimensao_ativa": dimensao.value,
        "total_obitos": int(total_obitos),
        "total_custos": float(total_custos),
        "total_atendimentos": int(total_atend),
        "serie_obitos": serie_obitos,
        "obitos_por_tipo_veiculo": obitos_tipo,
    }


@router.get("/mapa")
async def dados_mapa(
    ano: int | None = None,
    uf: str | None = Query(None, alias="uf"),
    regiao: Regiao | None = Query(None, alias="regiao"),
    dimensao: Dimensao = Query(Dimensao.ocorrencia, alias="dimensao"),
    metrica: str = "obitos",
):
    """Dados agregados por municipio para visualizacao no mapa."""
    con = get_connection()
    w = _where(ano=ano, uf=uf, regiao=regiao)
    has_pop = _has_view(con, "v_ibge_populacao")
    join_ibge = _ibge_municipios_join(con, "o")
    mun_sel, uf_sel = _ibge_label_exprs(con, "o")
    uf_filt_mapa = "COALESCE(ibge.uf, o.uf)" if join_ibge else None
    wa_o = _where_and(
        ano=ano, uf=uf, regiao=regiao, table_alias="o", uf_expr=uf_filt_mapa
    )
    join_pop = (
        """
            LEFT JOIN v_ibge_populacao pop
              ON LEFT(o.cod_mun_ibge, 6) = LEFT(pop.cod_mun_ibge, 6)
             AND o.ano = pop.ano
        """
        if has_pop
        else ""
    )

    if metrica == "custos":
        if has_pop:
            rows = (
                con.sql(
                    f"""
            SELECT o.cod_mun_ibge, {mun_sel} AS municipio, {uf_sel} AS uf,
                   {expr_round_numeric("SUM(o.custo_total)")} AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   MAX(o.lat) AS lat, MAX(o.lon) AS lon,
                   MAX(pop.populacao) AS populacao,
                   {expr_round_numeric(
                       "SUM(o.custo_total) / NULLIF(MAX(pop.populacao), 0)"
                   )} AS custo_per_capita
            FROM v_custos o {join_pop}
            {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY o.cod_mun_ibge
            ORDER BY valor DESC
        """
                )
                .fetchdf()
                .to_dict(orient="records")
            )
        else:
            rows = (
                con.sql(
                    f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   {expr_round_numeric("SUM(o.custo_total)")} AS valor,
                   SUM(o.total_atendimentos) AS atendimentos,
                   MAX(o.lat) AS lat, MAX(o.lon) AS lon,
                   CAST(NULL AS BIGINT) AS populacao,
                   CAST(NULL AS DOUBLE) AS custo_per_capita
            FROM v_custos o
            {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
            ORDER BY valor DESC
        """
                )
                .fetchdf()
                .to_dict(orient="records")
            )
    else:
        view_obitos = f"v_obitos_{dimensao.value}"
        if not _has_view(con, view_obitos):
            view_obitos = "v_obitos"

        if has_pop:
            rows = (
                con.sql(
                    f"""
            SELECT o.cod_mun_ibge, {mun_sel} AS municipio, {uf_sel} AS uf,
                   SUM(o.total_obitos) AS valor,
                   MAX(o.lat) AS lat, MAX(o.lon) AS lon,
                   MAX(COALESCE(o.populacao_estimada, pop.populacao)) AS populacao,
                   (SUM(o.total_obitos) * 100000.0 / NULLIF(
                       MAX(COALESCE(o.populacao_estimada, pop.populacao)), 0
                   )) AS taxa_obitos_100mil
            FROM {view_obitos} o {join_pop}
            {join_ibge}
            WHERE 1=1 {wa_o}
            GROUP BY o.cod_mun_ibge
            ORDER BY valor DESC
        """
                )
                .fetchdf()
                .to_dict(orient="records")
            )
        else:
            rows = (
                con.sql(
                    f"""
            SELECT o.cod_mun_ibge, o.municipio, o.uf,
                   SUM(o.total_obitos) AS valor,
                   MAX(o.lat) AS lat, MAX(o.lon) AS lon,
                   MAX(o.populacao_estimada) AS populacao,
                   (SUM(o.total_obitos) * 100000.0 / NULLIF(MAX(o.populacao_estimada), 0))
                   AS taxa_obitos_100mil
            FROM {view_obitos} o
            {w}
            GROUP BY o.cod_mun_ibge, o.municipio, o.uf
            ORDER BY valor DESC
        """
                )
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
