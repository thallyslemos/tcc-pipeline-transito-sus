"""Extracao de dados reais do DATASUS via PySUS.

Baixa microdados do SIM (mortalidade) e SIA (producao ambulatorial)
diretamente do FTP do DATASUS, converte para Parquet.

Uso:
    from data-pipeline.datasus import baixar_sim, baixar_sia

    df_sim = baixar_sim(ufs=["BA"], anos=[2023])
    df_sia = baixar_sia(ufs=["BA"], anos=[2023])

Requisitos:
    - Acesso ao FTP do DATASUS (ftp.datasus.gov.br)
    - Pode nao funcionar em ambientes sandbox/CI sem acesso de rede

Referencia:
    - SIM: Sistema de Informacoes sobre Mortalidade
      Campos: CAUSABAS (causa basica CID-10), DTOBITO, CODMUNOCOR, etc.
      Manual: https://svs.aids.gov.br/daent/cgiae/sim/documentacao/

    - SIA/PA: Sistema de Informacoes Ambulatoriais - Producao Ambulatorial
      Campos: PA_CIDPRI, PA_VALAPR, PA_QTDAPR, PA_UFMUN, etc.
      Manual: https://wiki.saude.gov.br/sia/index.php
"""

import pandas as pd

from .logging import get_logger

logger = get_logger(__name__)

UFS_BRASIL = [
    "AC",
    "AL",
    "AM",
    "AP",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MG",
    "MS",
    "MT",
    "PA",
    "PB",
    "PE",
    "PI",
    "PR",
    "RJ",
    "RN",
    "RO",
    "RR",
    "RS",
    "SC",
    "SE",
    "SP",
    "TO",
]

UFS_POR_ESTADO = {
    "SP": ["SP"],
    "MG": ["MG"],
    "BA": ["BA"],
    "RJ": ["RJ"],
    "RS": ["RS"],
    "PR": ["PR"],
    "PE": ["PE"],
    "CE": ["CE"],
    "PA": ["PA"],
    "MA": ["MA"],
    "GO": ["GO"],
    "SC": ["SC"],
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

    Nota sobre campos financeiros:
        - PA_VALAPR: Valor Aprovado (R$) - valor financeiro aprovado
          pelo gestor para pagamento do procedimento ambulatorial.
          Fonte: Tabela de Procedimentos do SUS (SIGTAP).
        - PA_QTDAPR: Quantidade Aprovada - numero de procedimentos
          aprovados para pagamento.
        - O valor total de um registro e PA_VALAPR (ja e o total,
          NAO deve ser multiplicado por PA_QTDAPR).

    Referencia:
        Layout SIA/PA: https://wiki.saude.gov.br/sia/index.php
        SIGTAP: http://sigtap.datasus.gov.br
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
