"""Orquestrador do pipeline ETL (Bronze → Silver → Gold).

Executa todas as etapas sequencialmente com logging estruturado.
Uso: uv run python -m data-pipeline.run
"""

from .bronze import salvar_bronze
from .gold import gerar_gold_custos, gerar_gold_obitos
from .logging import get_logger, setup_logging
from .sample_data import gerar_sia, gerar_sim

logger = get_logger(__name__)


def run() -> None:
    """Executa o pipeline completo: geração → Bronze → Silver → Gold."""
    setup_logging()
    logger.info("pipeline_iniciado")

    # Bronze
    logger.info("etapa", camada="bronze", status="iniciando")
    df_sim = gerar_sim()
    df_sia = gerar_sia()
    bronze_sim = salvar_bronze(df_sim, "sim")
    bronze_sia = salvar_bronze(df_sia, "sia")
    logger.info("etapa", camada="bronze", status="concluído")

    # Silver
    from .silver import processar_silver_sia, processar_silver_sim

    logger.info("etapa", camada="silver", status="iniciando")
    silver_sim = processar_silver_sim(bronze_sim)
    silver_sia = processar_silver_sia(bronze_sia)
    logger.info("etapa", camada="silver", status="concluído")

    # Gold
    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos = gerar_gold_obitos(silver_sim)
    gold_custos = gerar_gold_custos(silver_sia)
    logger.info("etapa", camada="gold", status="concluído")

    logger.info(
        "pipeline_concluido",
        gold_obitos=str(gold_obitos),
        gold_custos=str(gold_custos),
    )


if __name__ == "__main__":
    run()
