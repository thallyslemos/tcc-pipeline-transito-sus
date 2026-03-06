"""Extracao de dados reais do DATASUS via PySUS.

Baixa microdados do SIM (mortalidade) e SIA (producao ambulatorial)
diretamente do FTP do DATASUS, converte para Parquet.

Cache do PySUS:
    O PySUS armazena os arquivos baixados em ~/pysus/ (configurável
    via variável PYSUS_CACHEPATH). Se o arquivo já existir localmente,
    download() retorna instantaneamente sem acessar o FTP.

Modos de download:
    - **Classico** (baixar_sim / baixar_sia): carrega tudo em memoria
      e retorna um DataFrame. Adequado para datasets pequenos.
    - **Streaming** (baixar_sim_streaming / baixar_sia_streaming): salva
      cada arquivo diretamente em disco via DuckDB (sem carregar em pandas)
      e libera a memoria. Indispensavel para datasets grandes.
      Pula parts já existentes no bronze (idempotente).

Uso:
    from data-pipeline.datasus import baixar_sim_streaming

    parts_dir = baixar_sim_streaming(ufs=["BA"], anos=[2024])

Requisitos:
    - Acesso ao FTP do DATASUS (ftp.datasus.gov.br) para primeiro download
    - Downloads subsequentes usam cache em ~/pysus/
"""

import gc
from pathlib import Path

import duckdb
import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

UFS_BRASIL = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
    "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
    "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]

UFS_POR_ESTADO = {
    "SP": ["SP"], "MG": ["MG"], "BA": ["BA"], "RJ": ["RJ"],
    "RS": ["RS"], "PR": ["PR"], "PE": ["PE"], "CE": ["CE"],
    "PA": ["PA"], "MA": ["MA"], "GO": ["GO"], "SC": ["SC"],
}


def baixar_sim(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
) -> pd.DataFrame:
    """Baixa dados do SIM (mortalidade) via PySUS.

    Args:
        ufs: Lista de UFs (ex: ["BA","SP"]). None = todas.
        anos: Lista de anos. Padrao: [2019..2023].

    Returns:
        DataFrame com microdados do SIM.

    Raises:
        ConnectionError: Se FTP do DATASUS nao acessivel.
    """
    from pysus.online_data.SIM import SIM

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))

    logger.info("sim_download_iniciando", ufs=ufs, anos=anos)

    sim = SIM().load()
    all_dfs = []

    for uf in ufs:
        for ano in anos:
            try:
                files = sim.get_files("CID10", uf=uf, year=ano)
                if not files:
                    logger.warning("sim_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files:
                    parquet = sim.download(f)
                    df = parquet.to_dataframe()
                    df["UF"] = uf
                    all_dfs.append(df)
                    logger.info("sim_arquivo_baixado", uf=uf, ano=ano, registros=len(df))
            except Exception as e:
                logger.error("sim_erro_download", uf=uf, ano=ano, erro=str(e))

    if not all_dfs:
        msg = "Nenhum dado SIM baixado. Verifique conexao com FTP DATASUS."
        raise ConnectionError(msg)

    result = pd.concat(all_dfs, ignore_index=True)
    logger.info("sim_download_concluido", total=len(result))
    return result


def baixar_sia(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    meses: list[int] | None = None,
) -> pd.DataFrame:
    """Baixa dados do SIA/PA (producao ambulatorial) via PySUS.

    Args:
        ufs: Lista de UFs. None = ["BA","SP","MG"].
        anos: Lista de anos. Padrao: [2019..2023].
        meses: Lista de meses (1-12). None = todos.

    Returns:
        DataFrame com microdados do SIA (PA).
    """
    from pysus.online_data.SIA import SIA

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    meses = meses or list(range(1, 13))

    logger.info("sia_download_iniciando", ufs=ufs, anos=anos)

    sia = SIA().load()
    all_dfs = []

    for uf in ufs:
        for ano in anos:
            try:
                files = sia.get_files("PA", uf=uf, year=ano, month=meses)
                if not files:
                    logger.warning("sia_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files if isinstance(files, list) else [files]:
                    parquet = sia.download(f)
                    df = parquet.to_dataframe()
                    df["UF"] = uf
                    all_dfs.append(df)
                    logger.info(
                        "sia_arquivo_baixado",
                        uf=uf,
                        ano=ano,
                        registros=len(df),
                    )
            except Exception as e:
                logger.error("sia_erro_download", uf=uf, ano=ano, erro=str(e))

    if not all_dfs:
        msg = "Nenhum dado SIA baixado. Verifique conexao com FTP DATASUS."
        raise ConnectionError(msg)

    result = pd.concat(all_dfs, ignore_index=True)
    logger.info("sia_download_concluido", total=len(result))
    return result


# ── Funcoes de download streaming (baixo consumo de memoria) ────────────────


def _liberar_memoria() -> None:
    """Forca coleta de lixo para liberar memoria entre downloads."""
    gc.collect()


def _pysus_to_bronze_duckdb(pysus_path: str, bronze_path: Path, uf: str) -> int:
    """Converte parquet PySUS para bronze via DuckDB (streaming, sem pandas).

    Adiciona coluna UF e retorna contagem de registros.
    Usa DuckDB COPY que faz streaming disco→disco sem carregar em RAM.
    """
    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT *, '{uf}' AS UF
            FROM read_parquet('{pysus_path}')
        ) TO '{bronze_path}' (FORMAT PARQUET)
    """)
    count = con.sql(f"SELECT COUNT(*) FROM read_parquet('{bronze_path}')").fetchone()[0]
    con.close()
    return count


def _resolve_pysus_parquet(pysus_data) -> str:
    """Extrai o caminho do parquet de um objeto Data do PySUS.

    PySUS retorna um objeto Data cuja str() é o caminho do arquivo.
    O cache pode ser um diretório .parquet/ contendo part files,
    ou um arquivo .parquet direto.
    """
    path = Path(str(pysus_data))
    if path.is_dir():
        inner = list(path.glob("*.parquet"))
        if inner:
            return str(inner[0])
        return f"{path}/*.parquet"
    return str(path)


def baixar_sim_streaming(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
) -> Path:
    """Baixa dados do SIM salvando cada arquivo via DuckDB (sem pandas).

    O PySUS faz cache em ~/pysus/. Se o arquivo já existe localmente,
    o download é instantâneo (leitura local). A conversão para bronze
    usa DuckDB COPY (streaming disco→disco, sem carregar em RAM).

    Parts de bronze já existentes são puladas (idempotente).

    Args:
        ufs: Lista de UFs (ex: ["BA","SP"]). None = ["BA","SP","MG"].
        anos: Lista de anos. Padrao: [2019..2023].

    Returns:
        Path do diretorio contendo os parquets parciais.
    """
    from pysus.online_data.SIM import SIM

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))

    logger.info("sim_streaming_iniciando", ufs=ufs, anos=anos)

    parts_dir = settings.resolve(settings.bronze_dir) / "sim_parts"
    parts_dir.mkdir(parents=True, exist_ok=True)

    sim = SIM().load()
    total_registros = 0
    part_idx = 0

    for uf in ufs:
        for ano in anos:
            try:
                files = sim.get_files("CID10", uf=uf, year=ano)
                if not files:
                    logger.warning("sim_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files:
                    part_path = parts_dir / f"sim_{uf}_{ano}_{part_idx}.parquet"

                    if part_path.exists():
                        con = duckdb.connect(":memory:")
                        n = con.sql(
                            f"SELECT COUNT(*) FROM read_parquet('{part_path}')"
                        ).fetchone()[0]
                        con.close()
                        total_registros += n
                        logger.info(
                            "sim_parte_cache",
                            uf=uf, ano=ano, registros=n, parte=part_idx,
                        )
                        part_idx += 1
                        continue

                    pysus_data = sim.download(f)
                    pysus_path = _resolve_pysus_parquet(pysus_data)
                    n = _pysus_to_bronze_duckdb(pysus_path, part_path, uf)
                    total_registros += n
                    logger.info(
                        "sim_parte_salva",
                        uf=uf, ano=ano, registros=n, parte=part_idx,
                    )
                    _liberar_memoria()
                    part_idx += 1
            except Exception as e:
                logger.error("sim_erro_download", uf=uf, ano=ano, erro=str(e))

    if total_registros == 0:
        msg = "Nenhum dado SIM baixado. Verifique conexao com FTP DATASUS."
        raise ConnectionError(msg)

    logger.info("sim_streaming_concluido", total=total_registros, partes=part_idx)
    return parts_dir


def baixar_sia_streaming(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    meses: list[int] | None = None,
) -> Path:
    """Baixa dados do SIA/PA via DuckDB (sem pandas, streaming).

    O PySUS faz cache em ~/pysus/. A conversão para bronze usa
    DuckDB COPY (streaming disco→disco). Parts já existentes são puladas.

    Args:
        ufs: Lista de UFs. None = ["BA","SP","MG"].
        anos: Lista de anos. Padrao: [2019..2023].
        meses: Lista de meses (1-12). None = todos.

    Returns:
        Path do diretorio contendo os parquets parciais.
    """
    from pysus.online_data.SIA import SIA

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    meses = meses or list(range(1, 13))

    logger.info("sia_streaming_iniciando", ufs=ufs, anos=anos)

    parts_dir = settings.resolve(settings.bronze_dir) / "sia_parts"
    parts_dir.mkdir(parents=True, exist_ok=True)

    sia = SIA().load()
    total_registros = 0
    part_idx = 0

    for uf in ufs:
        for ano in anos:
            try:
                files = sia.get_files("PA", uf=uf, year=ano, month=meses)
                if not files:
                    logger.warning("sia_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files if isinstance(files, list) else [files]:
                    part_path = parts_dir / f"sia_{uf}_{ano}_{part_idx}.parquet"

                    if part_path.exists():
                        con = duckdb.connect(":memory:")
                        n = con.sql(
                            f"SELECT COUNT(*) FROM read_parquet('{part_path}')"
                        ).fetchone()[0]
                        con.close()
                        total_registros += n
                        logger.info(
                            "sia_parte_cache",
                            uf=uf, ano=ano, registros=n, parte=part_idx,
                        )
                        part_idx += 1
                        continue

                    pysus_data = sia.download(f)
                    pysus_path = _resolve_pysus_parquet(pysus_data)
                    n = _pysus_to_bronze_duckdb(pysus_path, part_path, uf)
                    total_registros += n
                    logger.info(
                        "sia_parte_salva",
                        uf=uf, ano=ano, registros=n, parte=part_idx,
                    )
                    _liberar_memoria()
                    part_idx += 1
            except Exception as e:
                logger.error("sia_erro_download", uf=uf, ano=ano, erro=str(e))

    if total_registros == 0:
        msg = "Nenhum dado SIA baixado. Verifique conexao com FTP DATASUS."
        raise ConnectionError(msg)

    logger.info("sia_streaming_concluido", total=total_registros, partes=part_idx)
    return parts_dir
