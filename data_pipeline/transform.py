"""
Módulo de transformação - camadas Silver e Gold.

Aplica filtros CID V01-V89, tipagem, padronização e agregações
conforme arquitetura Medallion definida em ARCHITECTURE.md.
"""

import logging

import pandas as pd

from config.settings import CID_TRANSITO_PREFIX, CID_TRANSITO_RANGE
from data_pipeline.extract import filtrar_transito

logger = logging.getLogger(__name__)


def _is_cid_transito(codigo: str) -> bool:
    """Verifica se código CID-10 é acidente de trânsito (V01-V89)."""
    if not codigo or len(str(codigo).strip()) < 3:
        return False
    cod = str(codigo).strip().upper()
    if cod[0] != CID_TRANSITO_PREFIX:
        return False
    try:
        num = int(cod[1:3])
        return CID_TRANSITO_RANGE[0] <= num <= CID_TRANSITO_RANGE[1]
    except ValueError:
        return False


def bronze_to_silver_sim(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforma dados SIM Bronze em Silver.

    - Filtra CID V01-V89
    - Padroniza colunas (CODMUNOCOR/CODMUNRES -> cod_mun_ibge)
    - Extrai competência de DTOBITO

    Args:
        df: DataFrame Bronze (SIM raw).

    Returns:
        DataFrame Silver padronizado.
    """
    # Normaliza nome da coluna de município
    col_mun = "CODMUNOCOR" if "CODMUNOCOR" in df.columns else "CODMUNRES"
    if col_mun not in df.columns:
        col_mun = [c for c in df.columns if "MUN" in c.upper()][0] if df.columns.any() else None
    if col_mun is None:
        raise ValueError("Coluna de município não encontrada no SIM")

    col_causa = "CAUSABAS"
    col_data = "DTOBITO" if "DTOBITO" in df.columns else "DTOBITO"

    silver = filtrar_transito(df, col_causa).copy()

    # Padroniza código município (6-7 dígitos IBGE, sem caracteres não numéricos)
    silver["cod_mun_ibge"] = (
        silver[col_mun]
        .astype(str)
        .str.replace(r"\D", "", regex=True)
        .str.zfill(6)
    )

    # Extrai competência (mês/ano)
    if col_data in silver.columns:
        dt_series = pd.to_datetime(
            silver[col_data].astype(str),
            format="%d%m%Y",
            errors="coerce",
        )
        silver["competencia"] = dt_series.dt.to_period("M").dt.to_timestamp()
    else:
        silver["competencia"] = pd.Timestamp("2023-01-01")

    silver["causabas"] = silver[col_causa].astype(str).str.strip().str.upper()
    silver = silver[["cod_mun_ibge", "competencia", "causabas"]].dropna(
        subset=["cod_mun_ibge", "competencia"]
    )

    logger.info("Silver SIM: %d registros", len(silver))
    return silver


def silver_to_gold_obitos(silver_df: pd.DataFrame) -> pd.DataFrame:
    """
    Agrega Silver em Gold - óbitos por município/competência.

    Args:
        silver_df: DataFrame Silver do SIM.

    Returns:
        DataFrame Gold: cod_mun_ibge, competencia, obitos, causabas.
    """
    def _moda(serie):
        mode = serie.mode()
        return mode.iloc[0] if len(mode) > 0 else serie.iloc[0] if len(serie) > 0 else ""

    gold = (
        silver_df.groupby(["cod_mun_ibge", "competencia"], as_index=False)
        .agg(
            obitos=("causabas", "count"),
            causabas=("causabas", _moda),
        )
        .sort_values(["cod_mun_ibge", "competencia"])
    )
    logger.info("Gold óbitos: %d linhas", len(gold))
    return gold
