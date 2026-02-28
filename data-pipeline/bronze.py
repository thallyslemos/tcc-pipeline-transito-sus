"""Camada Bronze — ingestão de dados brutos para Parquet.

Persiste DataFrames brutos (SIM e SIA) em formato Parquet
particionado por UF. Nenhuma transformação é aplicada.
"""

from pathlib import Path

import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def salvar_bronze(df: pd.DataFrame, sistema: str) -> Path:
    """Salva DataFrame bruto como Parquet na camada Bronze.

    Args:
        df: DataFrame com dados brutos (SIM ou SIA).
        sistema: Identificador do sistema ("sim" ou "sia").

    Returns:
        Caminho do arquivo Parquet salvo.
    """
    destino = settings.resolve(settings.bronze_dir) / f"{sistema}.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(destino, engine="pyarrow", index=False)
    logger.info("bronze_salvo", sistema=sistema, registros=len(df), caminho=str(destino))
    return destino
