"""MCP Server para consulta de dados de acidentes de transito no SUS.

Expoe tools que permitem LLMs (locais ou cloud) consultar o DuckDB
via linguagem natural usando o Model Context Protocol (MCP).

Uso com Ollama (local):
    1. Inicie o servidor: uv run python -m mcp-server.server
    2. Configure o Ollama ou cliente MCP para conectar via stdio

Uso standalone (teste):
    uv run python -m mcp-server.server

Referencia: https://modelcontextprotocol.io
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

settings = config.settings
gold_dir = settings.resolve(settings.gold_dir)
data_dir = settings.resolve(settings.data_dir)

mcp = FastMCP(
    "Transito SUS",
    instructions=(
        "Voce e um assistente especializado em dados de acidentes de transito "
        "no Sistema Unico de Saude (SUS) do Brasil. Voce tem acesso a dados de "
        "mortalidade (SIM) e custos ambulatoriais (SIA) de 2019 a 2023, para "
        "9 municipios em 3 estados (SP, MG, BA). Use as tools disponiveis para "
        "responder perguntas sobre obitos, custos, tendencias e comparacoes."
    ),
)


def _get_con() -> duckdb.DuckDBPyConnection:
    """Cria conexao DuckDB com views sobre os Parquet Gold e IBGE (quando existirem)."""
    con = duckdb.connect(":memory:")
    con.sql(f"""
        CREATE VIEW v_obitos AS
        SELECT * FROM read_parquet('{gold_dir}/obitos_municipio_mes.parquet')
    """)
    con.sql(f"""
        CREATE VIEW v_custos AS
        SELECT * FROM read_parquet('{gold_dir}/custos_municipio_mes.parquet')
    """)
    ibge_mun = data_dir / "ibge_municipios.parquet"
    ibge_pop = data_dir / "ibge_populacao.parquet"
    if ibge_mun.exists():
        con.sql(f"CREATE VIEW v_ibge_municipios AS SELECT * FROM read_parquet('{ibge_mun}')")
    if ibge_pop.exists():
        con.sql(f"CREATE VIEW v_ibge_populacao AS SELECT * FROM read_parquet('{ibge_pop}')")
    return con


@mcp.tool()
def query_obitos(
    municipio: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
) -> str:
    """Consulta obitos por acidentes de transito no SUS.

    Args:
        municipio: Nome do municipio (ex: 'Sao Paulo', 'Salvador').
        ano: Ano de referencia (2019-2023).
        tipo_veiculo: Tipo de veiculo (ex: 'Motociclista', 'Automovel', 'Pedestre').

    Returns:
        Dados de obitos com total, municipio e periodo.
    """
    con = _get_con()
    clauses = []
    if municipio:
        clauses.append(f"municipio ILIKE '%{municipio}%'")
    if ano:
        clauses.append(f"ano = {ano}")
    if tipo_veiculo:
        clauses.append(f"tipo_veiculo ILIKE '%{tipo_veiculo}%'")

    where = "WHERE " + " AND ".join(clauses) if clauses else ""

    result = con.sql(f"""
        SELECT municipio, ano, tipo_veiculo,
               SUM(total_obitos) AS total_obitos
        FROM v_obitos {where}
        GROUP BY municipio, ano, tipo_veiculo
        ORDER BY total_obitos DESC
        LIMIT 20
    """).fetchdf()
    con.close()

    if result.empty:
        return "Nenhum registro encontrado com os filtros informados."
    return result.to_string(index=False)


@mcp.tool()
def query_custos(
    municipio: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
) -> str:
    """Consulta custos ambulatoriais de acidentes de transito no SUS.

    Args:
        municipio: Nome do municipio.
        ano: Ano de referencia (2019-2023).
        tipo_veiculo: Tipo de veiculo.

    Returns:
        Dados de custos com total em reais, atendimentos e municipio.
    """
    con = _get_con()
    clauses = []
    if municipio:
        clauses.append(f"municipio ILIKE '%{municipio}%'")
    if ano:
        clauses.append(f"ano = {ano}")
    if tipo_veiculo:
        clauses.append(f"tipo_veiculo ILIKE '%{tipo_veiculo}%'")

    where = "WHERE " + " AND ".join(clauses) if clauses else ""

    result = con.sql(f"""
        SELECT municipio, ano,
               ROUND(SUM(custo_total), 2) AS custo_total_reais,
               SUM(total_atendimentos) AS total_atendimentos
        FROM v_custos {where}
        GROUP BY municipio, ano
        ORDER BY custo_total_reais DESC
        LIMIT 20
    """).fetchdf()
    con.close()

    if result.empty:
        return "Nenhum registro encontrado."
    return result.to_string(index=False)


@mcp.tool()
def query_taxa_mortalidade(
    municipio: str | None = None,
    ano: int = 2023,
) -> str:
    """Calcula taxa de mortalidade por 100 mil habitantes.

    Metodologia DATASUS: (obitos / populacao_estimada) * 100.000
    Fonte populacao: IBGE Tabela 6579 (estimativas anuais).

    Args:
        municipio: Nome do municipio (opcional, retorna todos se vazio).
        ano: Ano de referencia.

    Returns:
        Taxa por 100 mil hab, populacao e obitos por municipio.
    """
    con = _get_con()
    clause = f"AND municipio ILIKE '%{municipio}%'" if municipio else ""

    rows = con.sql(f"""
        SELECT cod_mun_ibge, municipio, SUM(total_obitos) AS obitos
        FROM v_obitos WHERE ano = {ano} {clause}
        GROUP BY cod_mun_ibge, municipio
        ORDER BY obitos DESC
    """).fetchdf()
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

    return "\n".join(resultados) if resultados else "Nenhum dado encontrado."


@mcp.tool()
def query_serie_temporal(
    municipio: str,
    metrica: str = "obitos",
) -> str:
    """Retorna serie temporal mensal de um municipio.

    Args:
        municipio: Nome do municipio.
        metrica: 'obitos' ou 'custos'.

    Returns:
        Serie temporal com competencia e valor mensal.
    """
    con = _get_con()
    if metrica == "custos":
        result = con.sql(f"""
            SELECT STRFTIME(competencia, '%Y-%m') AS mes,
                   ROUND(SUM(custo_total), 2) AS valor
            FROM v_custos
            WHERE municipio ILIKE '%{municipio}%'
            GROUP BY STRFTIME(competencia, '%Y-%m')
            ORDER BY mes
        """).fetchdf()
    else:
        result = con.sql(f"""
            SELECT STRFTIME(competencia, '%Y-%m') AS mes,
                   SUM(total_obitos) AS valor
            FROM v_obitos
            WHERE municipio ILIKE '%{municipio}%'
            GROUP BY STRFTIME(competencia, '%Y-%m')
            ORDER BY mes
        """).fetchdf()
    con.close()

    if result.empty:
        return f"Nenhum dado de {metrica} para {municipio}."
    return result.to_string(index=False)


@mcp.tool()
def listar_municipios() -> str:
    """Lista os municipios disponiveis na base com totais gerais."""
    con = _get_con()
    result = con.sql("""
        SELECT municipio, uf, SUM(total_obitos) AS total_obitos
        FROM v_obitos
        GROUP BY municipio, uf
        ORDER BY total_obitos DESC
    """).fetchdf()
    con.close()
    return result.to_string(index=False)


if __name__ == "__main__":
    mcp.run()
