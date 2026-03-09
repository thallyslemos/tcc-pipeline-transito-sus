"""MCP Server para consulta de dados de acidentes de transito no SUS.

Expoe tools que permitem LLMs (locais ou cloud) consultar o DuckDB
via linguagem natural usando o Model Context Protocol (MCP).
"""

import sys
from importlib import import_module
from pathlib import Path

import duckdb
from fastmcp import FastMCP

# Garante que a raiz do projeto esta no path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

config = import_module("data-pipeline.config")
ibge_mod = import_module("data-pipeline.ibge")
router_utils = import_module("backend.routers.utils")

settings = config.settings
gold_dir = settings.resolve(settings.gold_dir)
data_dir = settings.resolve(settings.data_dir)

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


def _get_con() -> duckdb.DuckDBPyConnection:
    """Cria conexao DuckDB com views sobre os Parquet Gold e IBGE (quando existirem)."""
    con = duckdb.connect(":memory:")

    ocorrencia_path = gold_dir / "obitos_ocorrencia_municipio_mes.parquet"
    residencia_path = gold_dir / "obitos_residencia_municipio_mes.parquet"
    custos_path = gold_dir / "custos_municipio_mes.parquet"

    if ocorrencia_path.exists():
        con.sql(
            f"CREATE VIEW v_obitos_ocorrencia AS SELECT * FROM read_parquet('{ocorrencia_path}')"
        )
        con.sql("CREATE OR REPLACE VIEW v_obitos AS SELECT * FROM v_obitos_ocorrencia")

    if residencia_path.exists():
        con.sql(
            f"CREATE VIEW v_obitos_residencia AS SELECT * FROM read_parquet('{residencia_path}')"
        )

    if custos_path.exists():
        con.sql(f"CREATE VIEW v_custos AS SELECT * FROM read_parquet('{custos_path}')")

    ibge_mun = data_dir / "ibge_municipios.parquet"
    ibge_pop = data_dir / "ibge_populacao.parquet"
    if ibge_mun.exists():
        con.sql(
            f"CREATE VIEW v_ibge_municipios AS SELECT * FROM read_parquet('{ibge_mun}')"
        )
    if ibge_pop.exists():
        con.sql(
            f"CREATE VIEW v_ibge_populacao AS SELECT * FROM read_parquet('{ibge_pop}')"
        )
    return con


@mcp.tool()
def listar_opcoes_filtro() -> str:
    """Lista os valores possíveis para os filtros de ano, UF, região e tipo de veículo."""
    con = _get_con()
    anos = con.sql("SELECT DISTINCT ano FROM v_obitos ORDER BY ano DESC").df()["ano"].tolist()
    ufs = con.sql("SELECT DISTINCT uf FROM v_obitos ORDER BY uf").df()["uf"].tolist()
    veiculos = (
        con.sql("SELECT DISTINCT tipo_veiculo FROM v_obitos ORDER BY tipo_veiculo")
        .df()["tipo_veiculo"]
        .tolist()
    )
    regioes = list(router_utils.REGIOES.keys())
    con.close()
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
    con = _get_con()
    clauses = []
    if municipio:
        clauses.append(f"municipio ILIKE '%{municipio}%'")
    if uf:
        clauses.append(f"uf = '{uf.upper()}'")
    if regiao:
        ufs = router_utils.REGIOES.get(regiao.title())
        if ufs:
            clauses.append(f"uf IN {tuple(ufs)}")
    if ano:
        clauses.append(f"ano = {ano}")
    if tipo_veiculo:
        clauses.append(f"tipo_veiculo ILIKE '%{tipo_veiculo}%'")

    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    view = f"v_obitos_{dimensao}"

    result = con.sql(
        f"""
        SELECT municipio, uf, ano, tipo_veiculo, SUM(total_obitos) AS total_obitos
        FROM {view} {where}
        GROUP BY municipio, uf, ano, tipo_veiculo
        ORDER BY total_obitos DESC
        LIMIT 20
    """
    ).fetchdf()
    con.close()

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
    con = _get_con()
    clauses = []
    if municipio:
        clauses.append(f"municipio ILIKE '%{municipio}%'")
    if uf:
        clauses.append(f"uf = '{uf.upper()}'")
    if regiao:
        ufs = router_utils.REGIOES.get(regiao.title())
        if ufs:
            clauses.append(f"uf IN {tuple(ufs)}")
    if ano:
        clauses.append(f"ano = {ano}")
    if tipo_veiculo:
        clauses.append(f"tipo_veiculo ILIKE '%{tipo_veiculo}%'")

    where = "WHERE " + " AND ".join(clauses) if clauses else ""

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
    con.close()

    if result.empty:
        return "Nenhum registro encontrado."
    return result.to_string(index=False)


@mcp.tool()
def query_taxa_mortalidade(
    municipio: str | None = None, uf: str | None = None, ano: int = 2022, dimensao: str = "ocorrencia"
) -> str:
    """Calcula taxa de mortalidade por 100 mil habitantes."""
    con = _get_con()
    clauses = []
    if municipio:
        clauses.append(f"municipio ILIKE '%{municipio}%'")
    if uf:
        clauses.append(f"uf = '{uf.upper()}'")
    
    where_clause = " AND ".join(clauses)
    view = f"v_obitos_{dimensao}"

    rows = con.sql(
        f"""
        SELECT cod_mun_ibge, municipio, SUM(total_obitos) AS obitos
        FROM {view} WHERE ano = {ano} AND {where_clause if where_clause else '1=1'}
        GROUP BY cod_mun_ibge, municipio
        ORDER BY obitos DESC
    """
    ).fetchdf()
    con.close()

    resultados = []
    for _, row in rows.iterrows():
        pop = ibge_mod.get_populacao(row["cod_mun_ibge"], ano)
        taxa = ibge_mod.taxa_por_100mil(float(row["obitos"]), pop) if pop else None
        resultados.append(
            f"{row['municipio']}: {int(row['obitos'])} obitos, "
            f"pop {pop:,} hab, taxa {taxa}/100mil hab"
            if pop
            else f"{row['municipio']}: {int(row['obitos'])} obitos (pop indisponivel)"
        )

    return "\\n".join(resultados) if resultados else "Nenhum dado encontrado."


@mcp.tool()
def query_serie_temporal(
    municipio: str, metrica: str = "obitos", dimensao: str = "ocorrencia"
) -> str:
    """Retorna serie temporal mensal de um municipio."""
    con = _get_con()
    if metrica == "custos":
        result = con.sql(
            f"""
            SELECT STRFTIME(competencia, '%Y-%m') AS mes,
                   ROUND(SUM(custo_total), 2) AS valor
            FROM v_custos
            WHERE municipio ILIKE '%{municipio}%'
            GROUP BY STRFTIME(competencia, '%Y-%m')
            ORDER BY mes
        """
        ).fetchdf()
    else:
        view = f"v_obitos_{dimensao}"
        result = con.sql(
            f"""
            SELECT STRFTIME(competencia, '%Y-%m') AS mes,
                   SUM(total_obitos) AS valor
            FROM {view}
            WHERE municipio ILIKE '%{municipio}%'
            GROUP BY STRFTIME(competencia, '%Y-%m')
            ORDER BY mes
        """
        ).fetchdf()
    con.close()

    if result.empty:
        return f"Nenhum dado de {metrica} para {municipio}."
    return result.to_string(index=False)


@mcp.tool()
def listar_municipios(uf: str | None = None) -> str:
    """Lista os municipios disponiveis na base com totais gerais, opcionalmente por UF."""
    con = _get_con()
    where = f"WHERE uf = '{uf.upper()}'" if uf else ""
    result = con.sql(
        f"""
        SELECT municipio, uf, SUM(total_obitos) AS total_obitos
        FROM v_obitos {where}
        GROUP BY municipio, uf
        ORDER BY total_obitos DESC
    """
    ).fetchdf()
    con.close()
    return result.to_string(index=False)


if __name__ == "__main__":
    mcp.run()
