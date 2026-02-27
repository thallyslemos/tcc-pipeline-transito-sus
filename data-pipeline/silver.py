"""Camada Silver — limpeza, filtragem e padronização.

Aplica o filtro CID-10 V01–V89 (acidentes de transporte terrestre),
padroniza tipos e adiciona campos derivados.
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def processar_silver_sim(bronze_path: Path) -> Path:
    """Processa SIM Bronze → Silver: filtra CID e padroniza campos.

    Args:
        bronze_path: Caminho do Parquet Bronze do SIM.

    Returns:
        Caminho do Parquet Silver gerado.
    """
    destino = settings.resolve(settings.silver_dir) / "sim.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT
                CAUSABAS                                         AS causabas,
                LEFT(CAUSABAS, 3)                                AS cid_grupo,
                CAST(DTOBITO AS DATE)                            AS dt_obito,
                DATE_TRUNC('month', CAST(DTOBITO AS DATE))       AS competencia,
                CAST(CODMUNOCOR AS VARCHAR)                      AS cod_mun_ocorrencia,
                CAST(CODMUNRES AS VARCHAR)                       AS cod_mun_residencia,
                CAST(SEXO AS INTEGER)                            AS sexo,
                CAST(IDADE AS INTEGER)                           AS idade,
                UF                                               AS uf,
                CASE
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V01' AND 'V09' THEN 'Pedestre'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V10' AND 'V19' THEN 'Ciclista'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V20' AND 'V29' THEN 'Motociclista'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V30' AND 'V39' THEN 'Triciclo'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V40' AND 'V49' THEN 'Automóvel'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V50' AND 'V59' THEN 'Caminhonete'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V60' AND 'V69' THEN 'Veículo pesado'
                    WHEN LEFT(CAUSABAS, 3) BETWEEN 'V70' AND 'V79' THEN 'Ônibus'
                    ELSE 'Outros'
                END                                              AS tipo_veiculo,
                CASE WHEN SEXO = 1 THEN 'Masculino' ELSE 'Feminino' END AS sexo_desc,
                CASE
                    WHEN IDADE BETWEEN  0 AND 14 THEN '0-14'
                    WHEN IDADE BETWEEN 15 AND 24 THEN '15-24'
                    WHEN IDADE BETWEEN 25 AND 34 THEN '25-34'
                    WHEN IDADE BETWEEN 35 AND 44 THEN '35-44'
                    WHEN IDADE BETWEEN 45 AND 54 THEN '45-54'
                    WHEN IDADE BETWEEN 55 AND 64 THEN '55-64'
                    ELSE '65+'
                END                                              AS faixa_etaria
            FROM read_parquet('{bronze_path}')
            WHERE LEFT(CAUSABAS, 3) BETWEEN 'V01' AND 'V89'
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("silver_sim_processado", registros=total, caminho=str(destino))
    return destino


def processar_silver_sia(bronze_path: Path) -> Path:
    """Processa SIA Bronze → Silver: filtra CID e padroniza campos.

    Args:
        bronze_path: Caminho do Parquet Bronze do SIA.

    Returns:
        Caminho do Parquet Silver gerado.
    """
    destino = settings.resolve(settings.silver_dir) / "sia.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT
                PA_CIDPRI                                        AS cid_primario,
                LEFT(PA_CIDPRI, 3)                               AS cid_grupo,
                PA_CODMUN                                        AS cod_mun,
                PA_DATREF                                        AS datref,
                MAKE_DATE(
                    CAST(LEFT(PA_DATREF, 4) AS INTEGER),
                    CAST(RIGHT(PA_DATREF, 2) AS INTEGER),
                    1
                )                                                AS competencia,
                CAST(PA_VALAPR AS DECIMAL(12,2))                 AS valor_aprovado,
                CAST(PA_QTDAPR AS INTEGER)                       AS qtd_aprovada,
                PA_SEXO                                          AS sexo,
                CAST(PA_IDADE AS INTEGER)                        AS idade,
                UF                                               AS uf,
                CASE
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V01' AND 'V09' THEN 'Pedestre'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V10' AND 'V19' THEN 'Ciclista'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V20' AND 'V29' THEN 'Motociclista'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V30' AND 'V39' THEN 'Triciclo'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V40' AND 'V49' THEN 'Automóvel'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V50' AND 'V59' THEN 'Caminhonete'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V60' AND 'V69' THEN 'Veículo pesado'
                    WHEN LEFT(PA_CIDPRI, 3) BETWEEN 'V70' AND 'V79' THEN 'Ônibus'
                    ELSE 'Outros'
                END                                              AS tipo_veiculo,
                CASE
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN  0 AND 14 THEN '0-14'
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN 15 AND 24 THEN '15-24'
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN 25 AND 34 THEN '25-34'
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN 35 AND 44 THEN '35-44'
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN 45 AND 54 THEN '45-54'
                    WHEN CAST(PA_IDADE AS INTEGER) BETWEEN 55 AND 64 THEN '55-64'
                    ELSE '65+'
                END                                              AS faixa_etaria
            FROM read_parquet('{bronze_path}')
            WHERE LEFT(PA_CIDPRI, 3) BETWEEN 'V01' AND 'V89'
        ) TO '{destino}' (FORMAT PARQUET)
    """)
    con.close()

    con2 = duckdb.connect(":memory:")
    total = con2.sql(f"SELECT COUNT(*) FROM '{destino}'").fetchone()[0]
    con2.close()
    logger.info("silver_sia_processado", registros=total, caminho=str(destino))
    return destino
