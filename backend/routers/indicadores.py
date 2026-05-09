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

from fastapi import APIRouter, Query

from ..database import get_connection
from ..ibge import (
    custo_per_capita,
    get_info,
    get_populacao,
    taxa_por_100mil,
)
from .utils import Regiao

router = APIRouter(prefix="/api/indicadores", tags=["Indicadores"])


@router.get("/municipio/{cod_mun}")
async def indicadores_municipio(cod_mun: str, ano: int | None = None):
    """Indicadores relativos por municipio com dados demograficos."""
    con = get_connection()
    info = get_info(cod_mun)
    if not info:
        return {"error": "Municipio nao encontrado"}

    cod6 = cod_mun[:6]

    anos_disponveis = [2019, 2020, 2021, 2022, 2023]
    if ano:
        anos_disponveis = [ano]

    indicadores_anuais = []
    last_pop = None
    for a in anos_disponveis:
        pop = get_populacao(cod_mun, a)
        if pop:
            last_pop = pop

        effective_pop = pop or last_pop
        if not effective_pop:
            continue

        obitos = con.execute(
            "SELECT COALESCE(SUM(total_obitos), 0) FROM v_obitos "
            "WHERE LEFT(cod_mun_ibge, 6) = ? AND ano = ?",
            [cod6, a],
        ).fetchone()[0]

        custos = con.execute(
            "SELECT COALESCE(SUM(custo_total), 0) FROM v_custos "
            "WHERE LEFT(cod_mun_ibge, 6) = ? AND ano = ?",
            [cod6, a],
        ).fetchone()[0]

        atend = con.execute(
            "SELECT COALESCE(SUM(total_atendimentos), 0) FROM v_custos "
            "WHERE LEFT(cod_mun_ibge, 6) = ? AND ano = ?",
            [cod6, a],
        ).fetchone()[0]

        indicadores_anuais.append(
            {
                "ano": a,
                "populacao": effective_pop,
                "obitos": int(obitos),
                "taxa_obitos_100mil": taxa_por_100mil(float(obitos), effective_pop),
                "custo_total": float(custos),
                "custo_per_capita": custo_per_capita(float(custos), effective_pop),
                "atendimentos": int(atend),
                "taxa_atend_100mil": taxa_por_100mil(float(atend), effective_pop),
            }
        )

    return {
        "cod_mun_ibge": cod_mun,
        "municipio": info["nome"],
        "uf": info["uf"],
        "regiao": info["regiao"],
        "area_km2": info.get("area_km2"),
        "idh": info.get("idh"),
        "pib_per_capita": info.get("pib_per_capita"),
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
async def ranking_indicadores(
    ano: int = 2023,
    metrica: str = "taxa_obitos_100mil",
    uf: str | None = Query(None, alias="uf"),
    regiao: Regiao | None = Query(None, alias="regiao"),
):
    """Ranking comparativo de municipios por indicador relativo."""
    con = get_connection()

    # Monta filtro de UF/região
    if regiao:
        from .utils import REGIOES
        ufs_in_region = REGIOES[regiao.value]
        uf_filter = f" AND uf IN {tuple(ufs_in_region)}"
    elif uf:
        uf_filter = f" AND uf = '{uf}'"
    else:
        uf_filter = ""

    codigos_query = f"""
        SELECT DISTINCT LEFT(cod_mun_ibge, 6) AS cod6
        FROM v_obitos
        WHERE ano = {ano}{uf_filter}
    """
    codigos = con.sql(codigos_query).fetchdf()["cod6"].tolist()
    resultados = []

    for cod6 in codigos:
        pop = get_populacao(cod6, ano)
        if not pop:
            for fallback_ano in [ano - 1, ano - 2, ano - 3]:
                pop = get_populacao(cod6, fallback_ano)
                if pop:
                    break
        info = get_info(cod6)
        if not pop or not info:
            continue

        obitos = con.execute(
            "SELECT COALESCE(SUM(total_obitos), 0) FROM v_obitos "
            "WHERE LEFT(cod_mun_ibge, 6) = ? AND ano = ?",
            [cod6, ano],
        ).fetchone()[0]

        custos = con.execute(
            "SELECT COALESCE(SUM(custo_total), 0) FROM v_custos "
            "WHERE LEFT(cod_mun_ibge, 6) = ? AND ano = ?",
            [cod6, ano],
        ).fetchone()[0]

        resultados.append(
            {
                "cod_mun_ibge": cod6,
                "municipio": info["nome"],
                "uf": info["uf"],
                "populacao": pop,
                "obitos": int(obitos),
                "taxa_obitos_100mil": taxa_por_100mil(float(obitos), pop),
                "custo_total": float(custos),
                "custo_per_capita": custo_per_capita(float(custos), pop),
            }
        )

    key = (
        metrica
        if metrica in ("taxa_obitos_100mil", "custo_per_capita")
        else "taxa_obitos_100mil"
    )
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
