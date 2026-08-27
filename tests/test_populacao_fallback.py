"""Testes unitarios do fallback de populacao (ano mais proximo disponivel).

Usa DuckDB in-memory com dados fabricados (nao depende de data/gold nem
data/silver reais), para cobrir de forma deterministica os tres cenarios do
contrato: populacao exata, populacao estimada (com ano de referencia e
defasagem corretos) e ausencia total de populacao (N/D sem quebrar).
"""

import duckdb
import pytest

from backend.routers.sim_only import _populacao_fallback_exprs


@pytest.fixture
def con():
    connection = duckdb.connect(":memory:")
    connection.sql(
        """
        CREATE TABLE ibge_populacao (cod_mun_ibge VARCHAR, ano INTEGER, populacao BIGINT)
        """
    )
    connection.sql(
        """
        INSERT INTO ibge_populacao VALUES
            ('999999', 2011, 1000),
            ('999999', 2021, 1200),
            ('999999', 2024, 1300),
            ('888888', 2020, 500)
        """
    )
    connection.sql("CREATE VIEW v_ibge_populacao AS SELECT * FROM ibge_populacao")
    yield connection
    connection.close()


def _run(con, cod_mun: str, ano: int, populacao_estimada: int | None) -> dict:
    """Simula o resultado ja agregado/filtrado (WHERE ano=X GROUP BY municipio)
    que cada endpoint real produz antes de aplicar o fallback: uma unica linha
    por municipio, com populacao_estimada exata do JOIN do Gold (ou NULL se o
    JOIN nao encontrou correspondencia para aquele ano)."""
    con.sql("CREATE OR REPLACE TABLE agregado (cod_mun_ibge_6 VARCHAR, populacao_estimada BIGINT)")
    valor = "NULL" if populacao_estimada is None else str(populacao_estimada)
    con.sql(f"INSERT INTO agregado VALUES ('{cod_mun}', {valor})")
    exprs = _populacao_fallback_exprs("cod_mun_ibge_6", ano, con)
    row = con.sql(
        f"""
        SELECT {exprs["populacao"]} AS populacao,
               {exprs["populacao_origem"]} AS populacao_origem,
               {exprs["populacao_ano_referencia"]} AS populacao_ano_referencia,
               {exprs["populacao_defasagem_anos"]} AS populacao_defasagem_anos
        FROM agregado
        WHERE cod_mun_ibge_6 = '{cod_mun}'
        GROUP BY cod_mun_ibge_6
        """
    ).fetchone()
    return {
        "populacao": row[0],
        "populacao_origem": row[1],
        "populacao_ano_referencia": row[2],
        "populacao_defasagem_anos": row[3],
    }


def test_municipio_ano_com_populacao_exata(con):
    """populacao_estimada ja presente (JOIN exato do Gold encontrou o ano)."""
    result = _run(con, "999999", 2021, populacao_estimada=1200)
    assert result["populacao"] == 1200
    assert result["populacao_origem"] == "exata"
    assert result["populacao_ano_referencia"] == 2021
    assert result["populacao_defasagem_anos"] == 0


def test_municipio_ano_sem_populacao_usa_ano_mais_proximo(con):
    """Sem populacao exata: usa o ano IBGE mais proximo do mesmo municipio."""
    # ano alvo 2019: distancia para 2011 e 8, para 2021 e 2 -> escolhe 2021
    result = _run(con, "999999", 2019, populacao_estimada=None)
    assert result["populacao"] == 1200
    assert result["populacao_origem"] == "estimada"
    assert result["populacao_ano_referencia"] == 2021
    assert result["populacao_defasagem_anos"] == 2


def test_empate_de_distancia_prefere_ano_anterior(con):
    """ano alvo 2016: distancia para 2011=5 e para 2021=5 -> empate, prefere 2011 (anterior)."""
    result = _run(con, "999999", 2016, populacao_estimada=None)
    assert result["populacao_ano_referencia"] == 2011
    assert result["populacao_defasagem_anos"] == 5
    assert result["populacao_origem"] == "estimada"


def test_municipio_sem_nenhuma_populacao_retorna_nd_sem_quebrar(con):
    """Municipio nunca aparece em v_ibge_populacao: taxa N/D, resposta nao quebra."""
    result = _run(con, "777777", 2020, populacao_estimada=None)
    assert result["populacao"] is None
    assert result["populacao_origem"] is None
    assert result["populacao_ano_referencia"] is None
    assert result["populacao_defasagem_anos"] is None


def test_view_ausente_retorna_nulls_sem_erro():
    """Sem v_ibge_populacao (artefato IBGE indisponivel), nao deve levantar excecao."""
    con = duckdb.connect(":memory:")
    con.sql("CREATE TABLE agregado (cod_mun_ibge_6 VARCHAR, populacao_estimada BIGINT)")
    con.sql("INSERT INTO agregado VALUES ('999999', NULL)")
    exprs = _populacao_fallback_exprs("cod_mun_ibge_6", 2020, con)
    row = con.sql(
        f"""
        SELECT {exprs["populacao"]} AS populacao,
               {exprs["populacao_origem"]} AS populacao_origem
        FROM agregado GROUP BY cod_mun_ibge_6
        """
    ).fetchone()
    assert row[0] is None
    assert row[1] is None
    con.close()
