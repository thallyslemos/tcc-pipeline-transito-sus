"""Orquestrador do pipeline ETL (Bronze -> Silver -> Gold).

Modos de operacao:
    1. Sample (padrao): Gera dados amostrais para 9 municipios.
       uv run python -m data-pipeline.run

    2. Real (PySUS): Baixa dados reais do DATASUS via FTP.
       uv run python -m data-pipeline.run --real --ufs BA SP --anos 2022 2023

    3. Estado completo: Todas as cidades de um estado.
       uv run python -m data-pipeline.run --real --ufs BA --anos 2023

Exemplos:
    # Dados amostrais (rapido, sem internet)
    uv run python -m data-pipeline.run

    # Bahia 2023 (dados reais do DATASUS)
    uv run python -m data-pipeline.run --real --ufs BA --anos 2023

    # SP + MG + BA, 2019-2023 (dados reais completos)
    uv run python -m data-pipeline.run --real --ufs SP MG BA --anos 2019 2020 2021 2022 2023

    # Todos os estados do Brasil, 2023
    uv run python -m data-pipeline.run --real --ufs ALL --anos 2023
"""

import argparse

from .bronze import salvar_bronze
from .gold import gerar_gold_custos, gerar_gold_obitos
from .logging import get_logger, setup_logging
from .silver import processar_silver_sia, processar_silver_sim

logger = get_logger(__name__)


def run_sample() -> None:
    """Pipeline com dados amostrais (offline, rapido)."""
    from .sample_data import gerar_sia, gerar_sim

    logger.info("modo", tipo="sample")
    df_sim = gerar_sim()
    df_sia = gerar_sia()
    _executar_etl(df_sim, df_sia)


def run_real(ufs: list[str], anos: list[int]) -> None:
    """Pipeline com dados reais do DATASUS (requer FTP).

    Args:
        ufs: Lista de UFs ou ["ALL"] para todos os estados.
        anos: Lista de anos para download.
    """
    from .datasus import UFS_BRASIL, baixar_sia, baixar_sim

    if ufs == ["ALL"]:
        ufs = UFS_BRASIL
        logger.info("modo", tipo="real", escopo="brasil_completo", anos=anos)
    else:
        logger.info("modo", tipo="real", ufs=ufs, anos=anos)

    df_sim = baixar_sim(ufs=ufs, anos=anos)
    df_sia = baixar_sia(ufs=ufs, anos=anos)
    _executar_etl(df_sim, df_sia)


def _executar_etl(df_sim, df_sia) -> None:
    """Executa Bronze -> Silver -> Gold."""
    logger.info("etapa", camada="bronze", status="iniciando")
    bronze_sim = salvar_bronze(df_sim, "sim")
    bronze_sia = salvar_bronze(df_sia, "sia")
    logger.info("etapa", camada="bronze", status="concluido")

    logger.info("etapa", camada="silver", status="iniciando")
    silver_sim = processar_silver_sim(bronze_sim)
    silver_sia = processar_silver_sia(bronze_sia)
    logger.info("etapa", camada="silver", status="concluido")

    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos = gerar_gold_obitos(silver_sim)
    gold_custos = gerar_gold_custos(silver_sia)
    logger.info("etapa", camada="gold", status="concluido")

    logger.info(
        "pipeline_concluido",
        gold_obitos=str(gold_obitos),
        gold_custos=str(gold_custos),
    )


def main() -> None:
    """Entry point com CLI."""
    setup_logging()
    logger.info("pipeline_iniciado")

    parser = argparse.ArgumentParser(
        description="Pipeline ETL de Acidentes de Transito no SUS",
    )
    parser.add_argument(
        "--real",
        action="store_true",
        help="Usar dados reais do DATASUS (requer acesso FTP)",
    )
    parser.add_argument(
        "--ufs",
        nargs="+",
        default=["BA", "SP", "MG"],
        help="UFs para download (ex: BA SP MG ou ALL para todos)",
    )
    parser.add_argument(
        "--anos",
        nargs="+",
        type=int,
        default=list(range(2019, 2024)),
        help="Anos para download (ex: 2022 2023)",
    )

    args = parser.parse_args()

    if args.real:
        run_real(ufs=args.ufs, anos=args.anos)
    else:
        run_sample()


if __name__ == "__main__":
    main()
