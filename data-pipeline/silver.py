"""Camada Silver — limpeza, filtragem e padronização.

Aplica o filtro CID-10 V01-V89 (acidentes de transporte terrestre),
padroniza tipos e adiciona campos derivados.

Suporta tanto arquivo Bronze unico quanto diretorio de partes
(gerado pelo download streaming).

Tratamento de tipos — dados reais do PySUS/DATASUS:
    Todas as colunas vem como VARCHAR com espaços à esquerda/direita.
    Este modulo usa TRIM + TRY_CAST para normalizar.

    DTOBITO (SIM): string "DDMMYYYY" (ex: "17052019").
    IDADE (SIM): codigo de 3 digitos (1o digito=unidade, 2o-3o=qtd).
        Ex: "498"=98 anos, "305"=5 meses→0 anos, "003"=3 (sample).
    PA_IDADE (SIA): inteiro simples (ex: "003"=3 anos).
        O flag PA_FLIDADE indica unidade (1=anos, 2=meses, 3=dias).
    PA_CMP (SIA 2024+): competencia YYYYMM. Layout antigo usa PA_DATREF.
    PA_MUNPCN (SIA real): municipio paciente. Sample usa PA_CODMUN.
    PA_VALAPR (SIA): valor com espaços (ex: "          10.90").
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


_DECODE_IDADE_SIM_SQL = """
CASE
    WHEN LENGTH(TRIM(CAST({col} AS VARCHAR))) = 3 THEN
        CASE
            WHEN TRY_CAST(SUBSTR(TRIM(CAST({col} AS VARCHAR)), 1, 1) AS INTEGER)
                 IN (0, 1, 2, 3) THEN 0
            WHEN TRY_CAST(SUBSTR(TRIM(CAST({col} AS VARCHAR)), 1, 1) AS INTEGER) = 4
                THEN TRY_CAST(SUBSTR(TRIM(CAST({col} AS VARCHAR)), 2, 2) AS INTEGER)
            WHEN TRY_CAST(SUBSTR(TRIM(CAST({col} AS VARCHAR)), 1, 1) AS INTEGER) = 5
                THEN 100 + TRY_CAST(SUBSTR(TRIM(CAST({col} AS VARCHAR)), 2, 2) AS INTEGER)
            ELSE NULL
        END
    ELSE TRY_CAST(TRIM(CAST({col} AS VARCHAR)) AS INTEGER)
END
"""

_DECODE_IDADE_SIA_SQL = """
CASE
    WHEN {fl_col} IS NOT NULL AND TRIM(CAST({fl_col} AS VARCHAR)) = '2'
        THEN 0
    WHEN {fl_col} IS NOT NULL AND TRIM(CAST({fl_col} AS VARCHAR)) = '3'
        THEN 0
    ELSE COALESCE(TRY_CAST(TRIM(CAST({col} AS VARCHAR)) AS INTEGER), 0)
END
"""

_DECODE_IDADE_SIA_SIMPLE_SQL = """
COALESCE(TRY_CAST(TRIM(CAST({col} AS VARCHAR)) AS INTEGER), 0)
"""

_FAIXA_ETARIA_SQL = """
CASE
    WHEN {idade} IS NULL THEN 'Ignorada'
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
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V01' AND 'V09' THEN 'Pedestre'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V10' AND 'V19' THEN 'Ciclista'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V20' AND 'V29' THEN 'Motociclista'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V30' AND 'V39' THEN 'Triciclo'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V40' AND 'V49' THEN 'Automóvel'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V50' AND 'V59' THEN 'Caminhonete'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V60' AND 'V69' THEN 'Veículo pesado'
    WHEN LEFT(TRIM(CAST({cid} AS VARCHAR)), 3) BETWEEN 'V70' AND 'V79' THEN 'Ônibus'
    ELSE 'Outros'
END
"""


def _get_columns(con: duckdb.DuckDBPyConnection, source: str) -> set[str]:
    """Retorna conjunto de nomes de colunas de um Parquet."""
    return {
        c[0]
        for c in con.sql(
            f"DESCRIBE SELECT * FROM read_parquet('{source}') LIMIT 0"
        ).fetchall()
    }


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
    decode_idade = _DECODE_IDADE_SIM_SQL.format(col="IDADE")
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
                        TRY_STRPTIME(TRIM(CAST(DTOBITO AS VARCHAR)), '%d%m%Y')
                    )                                                AS _dt,
                    ({decode_idade})                                  AS idade_anos,
                    COALESCE(TRY_CAST(TRIM(CAST(SEXO AS VARCHAR)) AS INTEGER), 0) AS sexo_int
                FROM read_parquet('{source}')
                WHERE LEFT(TRIM(CAST(CAUSABAS AS VARCHAR)), 1) = 'V'
                  AND TRY_CAST(
                        SUBSTR(TRIM(CAST(CAUSABAS AS VARCHAR)), 2, 2) AS INTEGER
                    ) BETWEEN 1 AND 89
            )
            SELECT
                TRIM(CAST(CAUSABAS AS VARCHAR))              AS causabas,
                LEFT(TRIM(CAST(CAUSABAS AS VARCHAR)), 3)     AS cid_grupo,
                _dt                                          AS dt_obito,
                DATE_TRUNC('month', _dt)                     AS competencia,
                TRIM(CAST(CODMUNOCOR AS VARCHAR))            AS cod_mun_ocorrencia,
                TRIM(CAST(CODMUNRES AS VARCHAR))             AS cod_mun_residencia,
                sexo_int                                     AS sexo,
                idade_anos                                   AS idade,
                TRIM(CAST(UF AS VARCHAR))                    AS uf,
                {tipo_veiculo}                               AS tipo_veiculo,
                CASE WHEN sexo_int = 1 THEN 'Masculino'
                     WHEN sexo_int = 2 THEN 'Feminino'
                     ELSE 'Ignorado'
                END                                          AS sexo_desc,
                {faixa_etaria}                               AS faixa_etaria
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


def _detect_sia_col(
    con: duckdb.DuckDBPyConnection,
    source: str,
    candidates: list[str],
    label: str,
) -> str:
    """Detecta qual coluna existe no Parquet SIA dentre os candidatos."""
    cols = _get_columns(con, source)
    for candidate in candidates:
        if candidate in cols:
            logger.info(f"sia_coluna_{label}", coluna=candidate)
            return candidate
    logger.warning(f"sia_sem_coluna_{label}", colunas_disponiveis=sorted(cols))
    msg = (
        f"Nenhuma coluna de {label} encontrada no SIA "
        f"({', '.join(candidates)}). Colunas: {sorted(cols)}"
    )
    raise ValueError(msg)


def processar_silver_sia(bronze_path: Path) -> Path:
    """Processa SIA Bronze → Silver: filtra CID e padroniza campos.

    Detecta automaticamente colunas de competência e município,
    pois o layout do SIA/PA varia entre versões do DATASUS.

    Args:
        bronze_path: Caminho do Parquet Bronze do SIA (arquivo ou diretório).

    Returns:
        Caminho do Parquet Silver gerado.
    """
    destino = settings.resolve(settings.silver_dir) / "sia.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    source = _parquet_source(bronze_path)
    faixa_etaria = _FAIXA_ETARIA_SQL.format(idade="idade_anos")
    tipo_veiculo = _TIPO_VEICULO_SQL.format(cid="PA_CIDPRI")

    con = duckdb.connect(":memory:")

    cols = _get_columns(con, source)

    date_col = _detect_sia_col(
        con, source,
        ["PA_CMP", "PA_DATREF", "PA_MVM"],
        "competencia",
    )
    mun_col = _detect_sia_col(
        con, source,
        ["PA_MUNPCN", "PA_CODMUN", "PA_UFMUN"],
        "municipio",
    )

    has_fl_idade = "PA_FLIDADE" in cols
    if has_fl_idade:
        decode_idade = _DECODE_IDADE_SIA_SQL.format(col="PA_IDADE", fl_col="PA_FLIDADE")
    else:
        decode_idade = _DECODE_IDADE_SIA_SIMPLE_SQL.format(col="PA_IDADE")

    date_expr = f"TRIM(CAST({date_col} AS VARCHAR))"

    con.sql(f"""
        COPY (
            WITH parsed AS (
                SELECT
                    *,
                    ({decode_idade})                        AS idade_anos,
                    {date_expr}                              AS _datref
                FROM read_parquet('{source}')
                WHERE LEFT(TRIM(CAST(PA_CIDPRI AS VARCHAR)), 3)
                      BETWEEN 'V01' AND 'V89'
            )
            SELECT
                TRIM(CAST(PA_CIDPRI AS VARCHAR))             AS cid_primario,
                LEFT(TRIM(CAST(PA_CIDPRI AS VARCHAR)), 3)    AS cid_grupo,
                TRIM(CAST({mun_col} AS VARCHAR))             AS cod_mun,
                _datref                                       AS datref,
                MAKE_DATE(
                    CAST(LEFT(_datref, 4) AS INTEGER),
                    CAST(RIGHT(_datref, 2) AS INTEGER),
                    1
                )                                             AS competencia,
                TRY_CAST(TRIM(CAST(PA_VALAPR AS VARCHAR)) AS DECIMAL(15,2))
                                                              AS valor_aprovado,
                COALESCE(TRY_CAST(TRIM(CAST(PA_QTDAPR AS VARCHAR)) AS INTEGER), 0)
                                                              AS qtd_aprovada,
                TRIM(CAST(PA_SEXO AS VARCHAR))                AS sexo,
                idade_anos                                    AS idade,
                TRIM(CAST(UF AS VARCHAR))                     AS uf,
                {tipo_veiculo}                                AS tipo_veiculo,
                {faixa_etaria}                                AS faixa_etaria
            FROM parsed
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("silver_sia_processado", registros=total, caminho=str(destino))
    return destino
