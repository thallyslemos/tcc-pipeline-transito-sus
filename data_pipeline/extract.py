"""
Módulo de extração de dados do DATASUS.

Responsável por baixar dados SIM (óbitos) e SIA (ambulatorial)
via PySUS, com fallback para dados sintéticos quando a rede
não estiver disponível (útil para validação e CI).
"""

import logging
from pathlib import Path

import pandas as pd

from config.settings import (
    ANOS_AMOSTRA,
    BRONZE_DIR,
    CID_TRANSITO_PREFIX,
    CID_TRANSITO_RANGE,
    UFS_AMOSTRA,
)

logger = logging.getLogger(__name__)


def _is_cid_transito(codigo: str) -> bool:
    """
    Verifica se código CID-10 é de acidente de trânsito (V01-V89).

    Args:
        codigo: Código CID-10 (ex: V012, V89).

    Returns:
        True se for acidente de trânsito.
    """
    if not codigo or len(codigo) < 3:
        return False
    if codigo[0].upper() != CID_TRANSITO_PREFIX:
        return False
    try:
        num = int(codigo[1:3])
        return CID_TRANSITO_RANGE[0] <= num <= CID_TRANSITO_RANGE[1]
    except ValueError:
        return False


def gerar_amostra_sim(
    n_registros: int = 5000,
    seed: int | None = 42,
) -> pd.DataFrame:
    """
    Gera amostra sintética de dados SIM para validação do pipeline.

    Schema baseado no layout DATASUS SIM-DO. Usado quando
    o download do DATASUS não está disponível.

    Args:
        n_registros: Quantidade de registros a gerar.
        seed: Seed para reprodutibilidade.

    Returns:
        DataFrame com schema compatível ao SIM.
    """
    import numpy as np

    rng = np.random.default_rng(seed)

    # Códigos CID trânsito (V01-V89) - amostra representativa
    cids = [f"V{i:02d}" for i in range(1, 90)] + [
        f"V{i:02d}1" for i in [2, 3, 4, 5, 6, 7]
    ]  # V20-V27 motos

    # Municípios prioritários + outros
    municipios = [
        "3550308",  # São Paulo
        "3106200",  # Belo Horizonte
        "2933307",  # Vitória da Conquista
        "3304557",  # Rio de Janeiro
        "4106902",  # Curitiba
    ]

    n = n_registros
    datas = pd.to_datetime(
        rng.integers(20220101, 20231231, n).astype(str),
        format="%Y%m%d",
        errors="coerce",
    )
    dt_str = pd.Series(datas).dt.strftime("%d%m%Y")
    df = pd.DataFrame(
        {
            "CAUSABAS": rng.choice(cids, n),
            "CODMUNOCOR": rng.choice(municipios, n),
            "DTOBITO": dt_str,
        }
    )

    # Remover datas inválidas
    df = df.dropna(subset=["DTOBITO"])
    logger.info("Amostra SIM sintética gerada: %d registros", len(df))
    return df


def extrair_sim_pysus(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    output_dir: Path | None = None,
) -> list[Path]:
    """
    Extrai dados SIM do DATASUS via PySUS.

    Args:
        ufs: Lista de UFs (ex: ['BA','SP']).
        anos: Lista de anos (ex: [2022, 2023]).
        output_dir: Diretório de saída. Default: BRONZE_DIR.

    Returns:
        Lista de paths dos arquivos Parquet gerados.
    """
    ufs = ufs or UFS_AMOSTRA
    anos = anos or ANOS_AMOSTRA
    output_dir = output_dir or BRONZE_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        from pysus.online_data.SIM import download

        result = download(
            groups="CID10",
            states=ufs,
            years=anos,
            data_dir=str(output_dir),
        )
        # PySUS retorna Data (ParquetSet) ou lista deles
        arquivos = result if isinstance(result, list) else [result]
        paths = [Path(getattr(f, "path", str(f))) for f in arquivos]
        logger.info("Download SIM concluído: %d arquivos", len(paths))
        return paths
    except Exception as e:
        logger.warning("Falha no download PySUS: %s. Usando amostra sintética.", e)
        df = gerar_amostra_sim(n_registros=5000)
        out_path = output_dir / "sim_amostra_sintetica.parquet"
        df.to_parquet(out_path, index=False)
        return [out_path]


def carregar_sim_bronze(source_path: Path) -> pd.DataFrame:
    """
    Carrega dados SIM do Parquet (Bronze).

    Args:
        source_path: Path do arquivo Parquet.

    Returns:
        DataFrame com dados brutos.
    """
    df = pd.read_parquet(source_path)
    logger.info("Carregado SIM Bronze: %s (%d linhas)", source_path.name, len(df))
    return df


def filtrar_transito(df: pd.DataFrame, col_causa: str = "CAUSABAS") -> pd.DataFrame:
    """
    Filtra registros de acidentes de trânsito (CID V01-V89).

    Args:
        df: DataFrame com coluna de causa.
        col_causa: Nome da coluna com código CID.

    Returns:
        DataFrame filtrado.
    """
    mask = df[col_causa].astype(str).str.upper().apply(_is_cid_transito)
    result = df[mask].copy()
    logger.info(
        "Filtro trânsito: %d -> %d registros (%.1f%%)",
        len(df),
        len(result),
        100 * len(result) / len(df) if len(df) > 0 else 0,
    )
    return result
