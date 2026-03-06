"""Camada Silver — limpeza, filtragem e padronização.

Aplica o filtro CID-10 V01-V89 (acidentes de transporte terrestre),
padroniza tipos e adiciona campos derivados.

Suporta tanto arquivo Bronze unico quanto diretorio de partes
(gerado pelo download streaming).

Tratamento de tipos:
    Dados amostrais (sample_data.py) usam tipos nativos Python (int, date).
    Dados reais do PySUS vem como VARCHAR em todas as colunas.
    Este modulo usa TRY_CAST para suportar ambos os cenarios.

    IDADE (SIM): codigo DATASUS de 3 digitos.
        1o digito = unidade (0=ignorada, 1=horas, 2=dias, 3=meses, 4=anos, 5=100+).
        2o-3o digitos = quantidade.
        Ex: "425" = 25 anos, "305" = 5 meses, "410" = 10 anos.
        Dados amostrais usam inteiro simples (ex: 25).

    DTOBITO (SIM): nos dados reais vem como string "DDMMYYYY" (ex: "11042024").
        Dados amostrais usam datetime.

    PA_IDADE (SIA): mesma logica de codificacao que o SIM.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def _parquet_source(path: Path) -> str:
    """Gera expressao DuckDB para ler parquet(s).

    Suporta arquivo unico ou diretorio de partes (glob).
    """
    if path.is_dir():
        return f"{path}/*.parquet"
    return str(path)


_DECODE_IDADE_SQL = """
CASE
    WHEN TRY_CAST({col} AS INTEGER) >= 400 AND TRY_CAST({col} AS INTEGER) < 500
        THEN TRY_CAST({col} AS INTEGER) - 400
    WHEN TRY_CAST({col} AS INTEGER) >= 500
        THEN TRY_CAST({col} AS INTEGER) - 500 + 100
    WHEN TRY_CAST({col} AS INTEGER) >= 100
        THEN 0
    ELSE COALESCE(TRY_CAST({col} AS INTEGER), 0)
END
"""

_FAIXA_ETARIA_SQL = """
CASE
    WHEN {idade} BETWEEN  0 AND 14 THEN '0-14'
    WHEN {idade} BETWEEN 15 AND 24 THEN '15-24'
    WHEN {idade} BETWEEN 25 AND 34 THEN '25-34'
    WHEN {idade} BETWEEN 35 AND 44 THEN '35-44'
    WHEN {idade} BETWEEN 45 AND 54 THEN '45-54'
    WHEN {idade} BETWEEN 55 AND 64 THEN '55-64'
    ELSE '65+'
END
"""

_TIPO_VEICULO_SQL = """
CASE
    WHEN LEFT({cid}, 3) BETWEEN 'V01' AND 'V09' THEN 'Pedestre'
    WHEN LEFT({cid}, 3) BETWEEN 'V10' AND 'V19' THEN 'Ciclista'
    WHEN LEFT({cid}, 3) BETWEEN 'V20' AND 'V29' THEN 'Motociclista'
    WHEN LEFT({cid}, 3) BETWEEN 'V30' AND 'V39' THEN 'Triciclo'
    WHEN LEFT({cid}, 3) BETWEEN 'V40' AND 'V49' THEN 'Automóvel'
    WHEN LEFT({cid}, 3) BETWEEN 'V50' AND 'V59' THEN 'Caminhonete'
    WHEN LEFT({cid}, 3) BETWEEN 'V60' AND 'V69' THEN 'Veículo pesado'
    WHEN LEFT({cid}, 3) BETWEEN 'V70' AND 'V79' THEN 'Ônibus'
    ELSE 'Outros'
END
"""


def processar_silver_sim(bronze_path: Path) -> Path:
    """Processa SIM Bronze → Silver: filtra CID e padroniza campos.

    Args:
        bronze_path: Caminho do Parquet Bronze do SIM (arquivo ou diretório).

    Returns:
        Caminho do Parquet Silver gerado.
    """
    destino = settings.resolve(settings.silver_dir) / "sim.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    source = _parquet_source(bronze_path)
    decode_idade = _DECODE_IDADE_SQL.format(col="IDADE")
    faixa_etaria = _FAIXA_ETARIA_SQL.format(idade="idade_anos")
    tipo_veiculo = _TIPO_VEICULO_SQL.format(cid="CAUSABAS")

    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            WITH parsed AS (
                SELECT
                    *,
                    COALESCE(
                        TRY_CAST(DTOBITO AS DATE),
                        TRY_STRPTIME(CAST(DTOBITO AS VARCHAR), '%d%m%Y')
                    )                                    AS _dt,
                    ({decode_idade})                      AS idade_anos,
                    COALESCE(TRY_CAST(SEXO AS INTEGER), 0) AS sexo_int
                FROM read_parquet('{source}')
                WHERE LEFT(CAST(CAUSABAS AS VARCHAR), 3) BETWEEN 'V01' AND 'V89'
            )
            SELECT
                CAST(CAUSABAS AS VARCHAR)                 AS causabas,
                LEFT(CAST(CAUSABAS AS VARCHAR), 3)        AS cid_grupo,
                _dt                                       AS dt_obito,
                DATE_TRUNC('month', _dt)                  AS competencia,
                CAST(CODMUNOCOR AS VARCHAR)               AS cod_mun_ocorrencia,
                CAST(CODMUNRES AS VARCHAR)                AS cod_mun_residencia,
                sexo_int                                  AS sexo,
                idade_anos                                AS idade,
                CAST(UF AS VARCHAR)                       AS uf,
                {tipo_veiculo}                            AS tipo_veiculo,
                CASE WHEN sexo_int = 1 THEN 'Masculino'
                     ELSE 'Feminino'
                END                                       AS sexo_desc,
                {faixa_etaria}                            AS faixa_etaria
            FROM parsed
            WHERE _dt IS NOT NULL
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("silver_sim_processado", registros=total, caminho=str(destino))
    return destino


def _detect_sia_date_col(con: duckdb.DuckDBPyConnection, source: str) -> str:
    """Detecta qual coluna de competência existe no Parquet SIA.

    O layout do SIA/PA mudou ao longo dos anos:
        - PA_CMP: competência (YYYYMM) — layout mais recente
        - PA_DATREF: data de referência (YYYYMM) — layout antigo / documentação PySUS
        - PA_MVM: mês de movimento (YYYYMM) — variante

    Returns:
        Expressão SQL que retorna a competência como VARCHAR YYYYMM.
    """
    cols = {
        c[0]
        for c in con.sql(f"DESCRIBE SELECT * FROM read_parquet('{source}') LIMIT 0").fetchall()
    }

    for candidate in ("PA_CMP", "PA_DATREF", "PA_MVM"):
        if candidate in cols:
            logger.info("sia_coluna_competencia", coluna=candidate)
            return f"CAST({candidate} AS VARCHAR)"

    logger.warning("sia_sem_coluna_competencia", colunas_disponiveis=sorted(cols))
    msg = (
        f"Nenhuma coluna de competencia encontrada no SIA (PA_CMP, PA_DATREF, PA_MVM). "
        f"Colunas disponíveis: {sorted(cols)}"
    )
    raise ValueError(msg)


def _detect_sia_mun_col(con: duckdb.DuckDBPyConnection, source: str) -> str:
    """Detecta qual coluna de município existe no Parquet SIA.

    Variantes: PA_CODMUN (preferido), PA_MUNPCN, PA_UFMUN.
    """
    cols = {
        c[0]
        for c in con.sql(f"DESCRIBE SELECT * FROM read_parquet('{source}') LIMIT 0").fetchall()
    }
    for candidate in ("PA_CODMUN", "PA_MUNPCN", "PA_UFMUN"):
        if candidate in cols:
            return candidate
    msg = f"Nenhuma coluna de município encontrada no SIA. Colunas: {sorted(cols)}"
    raise ValueError(msg)


def processar_silver_sia(bronze_path: Path) -> Path:
    """Processa SIA Bronze → Silver: filtra CID e padroniza campos.

    Detecta automaticamente as colunas de competência e município,
    pois o layout do SIA/PA varia entre versões do DATASUS.

    Args:
        bronze_path: Caminho do Parquet Bronze do SIA (arquivo ou diretório).

    Returns:
        Caminho do Parquet Silver gerado.
    """
    destino = settings.resolve(settings.silver_dir) / "sia.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    source = _parquet_source(bronze_path)
    decode_idade = _DECODE_IDADE_SQL.format(col="PA_IDADE")
    faixa_etaria = _FAIXA_ETARIA_SQL.format(idade="idade_anos")
    tipo_veiculo = _TIPO_VEICULO_SQL.format(cid="PA_CIDPRI")

    con = duckdb.connect(":memory:")

    date_expr = _detect_sia_date_col(con, source)
    mun_col = _detect_sia_mun_col(con, source)

    con.sql(f"""
        COPY (
            WITH parsed AS (
                SELECT
                    *,
                    ({decode_idade})                       AS idade_anos,
                    {date_expr}                             AS _datref
                FROM read_parquet('{source}')
                WHERE LEFT(CAST(PA_CIDPRI AS VARCHAR), 3) BETWEEN 'V01' AND 'V89'
            )
            SELECT
                CAST(PA_CIDPRI AS VARCHAR)                AS cid_primario,
                LEFT(CAST(PA_CIDPRI AS VARCHAR), 3)       AS cid_grupo,
                CAST({mun_col} AS VARCHAR)                AS cod_mun,
                _datref                                    AS datref,
                MAKE_DATE(
                    CAST(LEFT(_datref, 4) AS INTEGER),
                    CAST(RIGHT(_datref, 2) AS INTEGER),
                    1
                )                                          AS competencia,
                CAST(PA_VALAPR AS DECIMAL(12,2))           AS valor_aprovado,
                COALESCE(TRY_CAST(PA_QTDAPR AS INTEGER), 0) AS qtd_aprovada,
                CAST(PA_SEXO AS VARCHAR)                   AS sexo,
                idade_anos                                 AS idade,
                CAST(UF AS VARCHAR)                        AS uf,
                {tipo_veiculo}                             AS tipo_veiculo,
                {faixa_etaria}                             AS faixa_etaria
            FROM parsed
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("silver_sia_processado", registros=total, caminho=str(destino))
    return destino
