"""Router para indicadores relativos com dados demograficos do IBGE.

Metodologia:
- Taxa de mortalidade: (obitos / populacao) * 100.000
  Fonte: DATASUS - Ficha de Qualificacao C.12
  Ref: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm

- Populacao estimada: IBGE Tabela 6579 (metodo AiBi)
  Ref: https://sidra.ibge.gov.br/tabela/6579

- IDH Municipal: Atlas Brasil / PNUD
  Ref: https://www.atlasbrasil.org.br
"""

from importlib import import_module

from fastapi import APIRouter

from ..database import get_connection

router = APIRouter(prefix="/api/indicadores", tags=["Indicadores"])

ibge = import_module("data-pipeline.ibge")


@router.get("/municipio/{cod_mun}")
async def indicadores_municipio(cod_mun: str, ano: int | None = None):
    """Indicadores relativos por municipio com dados demograficos."""
    con = get_connection()
    info = ibge.get_info(cod_mun)
    if not info:
        return {"error": "Municipio nao encontrado"}

    anos_disponveis = [2019, 2020, 2021, 2022, 2023]
    if ano:
        anos_disponveis = [ano]

    indicadores_anuais = []
    for a in anos_disponveis:
        pop = ibge.get_populacao(cod_mun, a)
        if not pop:
            continue

        obitos = con.sql(f"""
            SELECT COALESCE(SUM(total_obitos), 0)
            FROM v_obitos WHERE cod_mun_ibge = '{cod_mun}' AND ano = {a}
        """).fetchone()[0]

        custos = con.sql(f"""
            SELECT COALESCE(SUM(custo_total), 0)
            FROM v_custos WHERE cod_mun_ibge = '{cod_mun}' AND ano = {a}
        """).fetchone()[0]

        atend = con.sql(f"""
            SELECT COALESCE(SUM(total_atendimentos), 0)
            FROM v_custos WHERE cod_mun_ibge = '{cod_mun}' AND ano = {a}
        """).fetchone()[0]

        indicadores_anuais.append(
            {
                "ano": a,
                "populacao": pop,
                "obitos": int(obitos),
                "taxa_obitos_100mil": ibge.taxa_por_100mil(float(obitos), pop),
                "custo_total": float(custos),
                "custo_per_capita": ibge.custo_per_capita(float(custos), pop),
                "atendimentos": int(atend),
                "taxa_atend_100mil": ibge.taxa_por_100mil(float(atend), pop),
            }
        )

    return {
        "cod_mun_ibge": cod_mun,
        "municipio": info["nome"],
        "uf": info["uf"],
        "regiao": info["regiao"],
        "area_km2": info["area_km2"],
        "idh": info["idh"],
        "pib_per_capita": info["pib_per_capita"],
        "indicadores": indicadores_anuais,
        "fontes": {
            "populacao": "IBGE - Estimativas da Populacao (Tabela 6579 SIDRA)",
            "mortalidade": "DATASUS - Sistema de Informacoes sobre Mortalidade (SIM)",
            "custos": "DATASUS - Sistema de Informacoes Ambulatoriais (SIA)",
            "metodologia_taxa": "Taxa por 100 mil hab = (eventos / populacao) * 100.000",
            "idh": "Atlas Brasil / PNUD (Censo 2010)",
        },
    }


@router.get("/ranking")
async def ranking_indicadores(ano: int = 2023, metrica: str = "taxa_obitos_100mil"):
    """Ranking comparativo de municipios por indicador relativo."""
    con = get_connection()
    resultados = []

    for cod_mun in ibge.POPULACAO_ESTIMADA:
        pop = ibge.get_populacao(cod_mun, ano)
        info = ibge.get_info(cod_mun)
        if not pop or not info:
            continue

        obitos = con.sql(f"""
            SELECT COALESCE(SUM(total_obitos), 0)
            FROM v_obitos WHERE cod_mun_ibge = '{cod_mun}' AND ano = {ano}
        """).fetchone()[0]

        custos = con.sql(f"""
            SELECT COALESCE(SUM(custo_total), 0)
            FROM v_custos WHERE cod_mun_ibge = '{cod_mun}' AND ano = {ano}
        """).fetchone()[0]

        resultados.append(
            {
                "cod_mun_ibge": cod_mun,
                "municipio": info["nome"],
                "uf": info["uf"],
                "populacao": pop,
                "obitos": int(obitos),
                "taxa_obitos_100mil": ibge.taxa_por_100mil(float(obitos), pop),
                "custo_total": float(custos),
                "custo_per_capita": ibge.custo_per_capita(float(custos), pop),
            }
        )

    key = metrica if metrica in ("taxa_obitos_100mil", "custo_per_capita") else "taxa_obitos_100mil"
    resultados.sort(key=lambda x: x[key], reverse=True)

    return {
        "ano": ano,
        "metrica": key,
        "ranking": resultados,
        "metodologia": {
            "taxa_obitos_100mil": "(obitos / populacao) * 100.000",
            "custo_per_capita": "custo_total / populacao",
            "fonte_populacao": "IBGE Tabela 6579",
        },
    }
