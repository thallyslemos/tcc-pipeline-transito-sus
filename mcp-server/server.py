"""MCP Server para consulta de dados de acidentes de transito no SUS.

Expoe tools que permitem LLMs (locais ou cloud) consultar o DuckDB
via linguagem natural usando o Model Context Protocol (MCP).
"""

import sys
from importlib import import_module
from pathlib import Path

from fastmcp import FastMCP

# Garante que a raiz do projeto esta no path para imports relativos
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.database import get_connection
from backend.routers.utils import (
    REGIOES,
    _literal_sql,
    dimensao_segura,
    ilike_clause,
    regiao_segura,
    uf_seguro,
)
from backend.sql_dialect import expr_competencia_yyyy_mm

ibge_mod = import_module("data-pipeline.ibge")
get_populacao = ibge_mod.get_populacao
taxa_por_100mil = ibge_mod.taxa_por_100mil

_MCP_QUERY_LIMIT = 500

mcp = FastMCP(
    "Transito SUS",
    instructions=(
        "Você é um assistente especializado em dados de acidentes de trânsito "
        "no Sistema Único de Saúde (SUS) do Brasil. Sua base de dados cobre "
        "mortalidade (SIM) e custos ambulatoriais (SIA). "
        "Use a ferramenta `listar_opcoes_filtro` para descobrir os anos, UFs, "
        "regiões e tipos de veículo disponíveis antes de fazer uma consulta. "
        "Por padrão, as análises de óbitos são pelo local de ocorrência, mas você "
        "pode especificar a análise por 'residencia' usando o parâmetro 'dimensao'."
    ),
)


def _filtro_clauses(
    *,
    municipio: str | None = None,
    uf: str | None = None,
    regiao: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
) -> list[str]:
    clauses: list[str] = []
    if municipio:
        part = ilike_clause("municipio", municipio)
        if part:
            clauses.append(part)
    if uf:
        safe = uf_seguro(uf)
        if safe:
            clauses.append(f"uf = {_literal_sql(safe)}")
    if regiao:
        reg = regiao_segura(regiao)
        if reg:
            ufs_list = REGIOES[reg]
            if len(ufs_list) == 1:
                clauses.append(f"uf = {_literal_sql(ufs_list[0])}")
            else:
                joined = ", ".join(_literal_sql(u) for u in ufs_list)
                clauses.append(f"uf IN ({joined})")
    if ano is not None:
        clauses.append(f"ano = {int(ano)}")
    if tipo_veiculo:
        part = ilike_clause("tipo_veiculo", tipo_veiculo)
        if part:
            clauses.append(part)
    return clauses


def _where_sql(clauses: list[str]) -> str:
    return "WHERE " + " AND ".join(clauses) if clauses else ""


@mcp.tool()
def listar_opcoes_filtro() -> str:
    """Lista os valores possíveis para os filtros de ano, UF, região e tipo de veículo."""
    con = get_connection()
    anos = con.sql("SELECT DISTINCT ano FROM v_obitos ORDER BY ano DESC").df()["ano"].tolist()
    ufs = con.sql("SELECT DISTINCT uf FROM v_obitos ORDER BY uf").df()["uf"].tolist()
    veiculos = (
        con.sql("SELECT DISTINCT tipo_veiculo FROM v_obitos ORDER BY tipo_veiculo")
        .df()["tipo_veiculo"]
        .tolist()
    )
    regioes = list(REGIOES.keys())
    return f"""Opções de filtro disponíveis:
- anos: {anos}
- ufs: {ufs}
- regioes: {regioes}
- tipos_veiculo: {veiculos}"""


@mcp.tool()
def query_obitos(
    municipio: str | None = None,
    uf: str | None = None,
    regiao: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
    dimensao: str = "ocorrencia",
) -> str:
    """Consulta óbitos por acidentes de trânsito no SUS."""
    con = get_connection()
    clauses = _filtro_clauses(
        municipio=municipio,
        uf=uf,
        regiao=regiao,
        ano=ano,
        tipo_veiculo=tipo_veiculo,
    )
    where = _where_sql(clauses)
    dim = dimensao_segura(dimensao)
    view = "v_obitos_ocorrencia" if dim == "ocorrencia" else "v_obitos_residencia"

    result = con.sql(
        f"""
        SELECT municipio, uf, ano, tipo_veiculo, SUM(total_obitos) AS total_obitos
        FROM {view} {where}
        GROUP BY municipio, uf, ano, tipo_veiculo
        ORDER BY total_obitos DESC
        LIMIT 20
    """
    ).fetchdf()

    if result.empty:
        return "Nenhum registro encontrado com os filtros informados."
    return result.to_string(index=False)


@mcp.tool()
def query_custos(
    municipio: str | None = None,
    uf: str | None = None,
    regiao: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
) -> str:
    """Consulta custos ambulatoriais de acidentes de trânsito no SUS."""
    con = get_connection()
    clauses = _filtro_clauses(
        municipio=municipio,
        uf=uf,
        regiao=regiao,
        ano=ano,
        tipo_veiculo=tipo_veiculo,
    )
    where = _where_sql(clauses)

    result = con.sql(
        f"""
        SELECT municipio, uf, ano,
               ROUND(SUM(custo_total), 2) AS custo_total_reais,
               SUM(total_atendimentos) AS total_atendimentos
        FROM v_custos {where}
        GROUP BY municipio, uf, ano
        ORDER BY custo_total_reais DESC
        LIMIT 20
    """
    ).fetchdf()

    if result.empty:
        return "Nenhum registro encontrado."
    return result.to_string(index=False)


@mcp.tool()
def query_taxa_mortalidade(
    municipio: str | None = None,
    uf: str | None = None,
    ano: int = 2022,
    dimensao: str = "ocorrencia",
) -> str:
    """Calcula taxa de mortalidade por 100 mil habitantes."""
    con = get_connection()
    clauses = _filtro_clauses(municipio=municipio, uf=uf, ano=ano)
    where_clause = " AND ".join(clauses) if clauses else "1=1"
    dim = dimensao_segura(dimensao)
    view = "v_obitos_ocorrencia" if dim == "ocorrencia" else "v_obitos_residencia"

    rows = con.sql(
        f"""
        SELECT cod_mun_ibge, municipio, SUM(total_obitos) AS obitos
        FROM {view} WHERE ano = {int(ano)} AND {where_clause}
        GROUP BY cod_mun_ibge, municipio
        ORDER BY obitos DESC
        LIMIT 50
    """
    ).fetchdf()

    resultados = []
    for _, row in rows.iterrows():
        pop = get_populacao(row["cod_mun_ibge"], ano)
        taxa = taxa_por_100mil(float(row["obitos"]), pop) if pop else None
        resultados.append(
            f"{row['municipio']}: {int(row['obitos'])} obitos, "
            f"pop {pop:,} hab, taxa {taxa}/100mil hab"
            if pop
            else f"{row['municipio']}: {int(row['obitos'])} obitos (pop indisponivel)"
        )

    return "\n".join(resultados) if resultados else "Nenhum dado encontrado."


@mcp.tool()
def query_serie_temporal(
    municipio: str, metrica: str = "obitos", dimensao: str = "ocorrencia"
) -> str:
    """Retorna serie temporal mensal de um municipio."""
    con = get_connection()
    comp = expr_competencia_yyyy_mm("competencia")
    mun_filter = ilike_clause("municipio", municipio)
    if not mun_filter:
        return "Nome de municipio invalido."
    if metrica == "custos":
        result = con.sql(
            f"""
            SELECT {comp} AS mes,
                   ROUND(SUM(custo_total), 2) AS valor
            FROM v_custos
            WHERE {mun_filter}
            GROUP BY competencia
            ORDER BY competencia
        """
        ).fetchdf()
    else:
        dim = dimensao_segura(dimensao)
        view = "v_obitos_ocorrencia" if dim == "ocorrencia" else "v_obitos_residencia"
        result = con.sql(
            f"""
            SELECT {comp} AS mes,
                   SUM(total_obitos) AS valor
            FROM {view}
            WHERE {mun_filter}
            GROUP BY competencia
            ORDER BY competencia
        """
        ).fetchdf()

    if result.empty:
        return f"Nenhum dado de {metrica} para {municipio}."
    return result.to_string(index=False)


@mcp.tool()
def listar_municipios(uf: str | None = None) -> str:
    """Lista os municipios disponiveis na base com totais gerais, opcionalmente por UF."""
    con = get_connection()
    clauses: list[str] = []
    if uf:
        safe = uf_seguro(uf)
        if safe:
            clauses.append(f"uf = {_literal_sql(safe)}")
    where = _where_sql(clauses)
    result = con.sql(
        f"""
        SELECT municipio, uf, SUM(total_obitos) AS total_obitos
        FROM v_obitos {where}
        GROUP BY municipio, uf
        ORDER BY total_obitos DESC
        LIMIT {_MCP_QUERY_LIMIT}
    """
    ).fetchdf()
    return result.to_string(index=False)


if __name__ == "__main__":
    mcp.run()
