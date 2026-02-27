"""Router para endpoints do dashboard — dados agregados para visualização."""

from fastapi import APIRouter

from ..database import get_connection

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
async def dashboard_summary(ano: int | None = None):
    """Resumo geral com KPIs, séries temporais e distribuições."""
    con = get_connection()
    filtro_ano = f"WHERE ano = {ano}" if ano else ""
    filtro_and = f"AND ano = {ano}" if ano else ""

    total_obitos = con.sql(f"""
        SELECT COALESCE(SUM(total_obitos), 0)
        FROM v_obitos {filtro_ano}
    """).fetchone()[0]

    total_custos = con.sql(f"""
        SELECT COALESCE(SUM(custo_total), 0)
        FROM v_custos {filtro_ano}
    """).fetchone()[0]

    total_atendimentos = con.sql(f"""
        SELECT COALESCE(SUM(total_atendimentos), 0)
        FROM v_custos {filtro_ano}
    """).fetchone()[0]

    municipios = con.sql(f"""
        SELECT COUNT(DISTINCT cod_mun_ibge) FROM v_obitos {filtro_ano}
    """).fetchone()[0]

    obitos_por_ano = con.sql("""
        SELECT ano, SUM(total_obitos) AS total
        FROM v_obitos GROUP BY ano ORDER BY ano
    """).fetchdf().to_dict(orient="records")

    custos_por_ano = con.sql("""
        SELECT ano, ROUND(SUM(custo_total), 2) AS total
        FROM v_custos GROUP BY ano ORDER BY ano
    """).fetchdf().to_dict(orient="records")

    obitos_por_tipo = con.sql(f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM v_obitos {filtro_ano}
        GROUP BY tipo_veiculo ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    custos_por_tipo = con.sql(f"""
        SELECT tipo_veiculo, ROUND(SUM(custo_total), 2) AS total
        FROM v_custos {filtro_ano}
        GROUP BY tipo_veiculo ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    obitos_por_mun = con.sql(f"""
        SELECT municipio, SUM(total_obitos) AS total
        FROM v_obitos {filtro_ano}
        GROUP BY municipio ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    custos_por_mun = con.sql(f"""
        SELECT municipio, ROUND(SUM(custo_total), 2) AS total
        FROM v_custos {filtro_ano}
        GROUP BY municipio ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    serie_obitos = con.sql(f"""
        SELECT
            STRFTIME(competencia, '%Y-%m') AS competencia,
            SUM(total_obitos) AS valor
        FROM v_obitos
        WHERE 1=1 {filtro_and}
        GROUP BY competencia ORDER BY competencia
    """).fetchdf().to_dict(orient="records")

    serie_custos = con.sql(f"""
        SELECT
            STRFTIME(competencia, '%Y-%m') AS competencia,
            ROUND(SUM(custo_total), 2) AS valor
        FROM v_custos
        WHERE 1=1 {filtro_and}
        GROUP BY competencia ORDER BY competencia
    """).fetchdf().to_dict(orient="records")

    obitos_faixa = con.sql(f"""
        SELECT faixa_etaria, SUM(total_obitos) AS total
        FROM v_obitos {filtro_ano}
        GROUP BY faixa_etaria
        ORDER BY CASE faixa_etaria
            WHEN '0-14' THEN 1 WHEN '15-24' THEN 2 WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4 WHEN '45-54' THEN 5 WHEN '55-64' THEN 6
            ELSE 7
        END
    """).fetchdf().to_dict(orient="records")

    obitos_sexo = con.sql(f"""
        SELECT sexo, SUM(total_obitos) AS total
        FROM v_obitos {filtro_ano}
        GROUP BY sexo ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    periodo = f"Ano {ano}" if ano else "2019-2023"

    return {
        "total_obitos": int(total_obitos),
        "total_custos": float(total_custos),
        "total_atendimentos": int(total_atendimentos),
        "municipios": int(municipios),
        "periodo": periodo,
        "obitos_por_ano": obitos_por_ano,
        "custos_por_ano": custos_por_ano,
        "obitos_por_tipo_veiculo": obitos_por_tipo,
        "custos_por_tipo_veiculo": custos_por_tipo,
        "obitos_por_municipio": obitos_por_mun,
        "custos_por_municipio": custos_por_mun,
        "serie_temporal_obitos": serie_obitos,
        "serie_temporal_custos": serie_custos,
        "obitos_por_faixa_etaria": obitos_faixa,
        "obitos_por_sexo": obitos_sexo,
    }


@router.get("/municipio/{cod_mun}")
async def detalhe_municipio(cod_mun: str):
    """Dados detalhados de um município específico."""
    con = get_connection()

    obitos_serie = con.sql(f"""
        SELECT
            STRFTIME(competencia, '%Y-%m') AS competencia,
            SUM(total_obitos) AS valor
        FROM v_obitos
        WHERE cod_mun_ibge = '{cod_mun}'
        GROUP BY competencia ORDER BY competencia
    """).fetchdf().to_dict(orient="records")

    custos_serie = con.sql(f"""
        SELECT
            STRFTIME(competencia, '%Y-%m') AS competencia,
            ROUND(SUM(custo_total), 2) AS valor
        FROM v_custos
        WHERE cod_mun_ibge = '{cod_mun}'
        GROUP BY competencia ORDER BY competencia
    """).fetchdf().to_dict(orient="records")

    por_tipo = con.sql(f"""
        SELECT tipo_veiculo, SUM(total_obitos) AS total
        FROM v_obitos WHERE cod_mun_ibge = '{cod_mun}'
        GROUP BY tipo_veiculo ORDER BY total DESC
    """).fetchdf().to_dict(orient="records")

    nome = con.sql(f"""
        SELECT DISTINCT municipio FROM v_obitos
        WHERE cod_mun_ibge = '{cod_mun}' LIMIT 1
    """).fetchone()

    return {
        "cod_mun_ibge": cod_mun,
        "municipio": nome[0] if nome else cod_mun,
        "serie_obitos": obitos_serie,
        "serie_custos": custos_serie,
        "obitos_por_tipo_veiculo": por_tipo,
    }


@router.get("/anos")
async def anos_disponiveis():
    """Lista anos disponíveis nos dados."""
    con = get_connection()
    anos = con.sql("SELECT DISTINCT ano FROM v_obitos ORDER BY ano").fetchdf()
    return {"anos": anos["ano"].tolist()}
