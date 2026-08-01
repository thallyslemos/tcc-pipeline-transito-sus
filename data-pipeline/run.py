"""Orquestrador do pipeline ETL (Bronze -> Silver -> Gold).

Modos de operacao:
    1. Sample (padrao): Gera dados amostrais para 9 municipios.
       uv run python -m data-pipeline.run

    2. Real (PySUS): Baixa dados reais do DATASUS via FTP.
       uv run python -m data-pipeline.run --real --ufs BA SP --anos 2022 2023

    3. Apenas enriquecimento externo (IBGE: localidades, populacao, malhas):
       uv run python -m data-pipeline.run --ibge

    4. Apenas SIM (sem SIA):
       uv run python -m data-pipeline.run --sim-only --ufs ALL --anos 2010 2011 2023

    5. Apenas malhas GeoJSON:
       uv run python -m data-pipeline.run --malhas

    6. Apenas Gold (requer Silver existente):
       uv run python -m data-pipeline.run --gold

    7. Carga PostgreSQL (requer DATABASE_URL e migrações aplicadas):
       uv run python -m data-pipeline.run --load-postgres

Exemplos:
    # Dados amostrais (rapido, sem internet)
    uv run python -m data-pipeline.run

    # Bahia 2023 (dados reais do DATASUS)
    uv run python -m data-pipeline.run --real --ufs BA --anos 2023

    # Só IBGE (localidades + populacao + malhas GeoJSON)
    uv run python -m data-pipeline.run --ibge

    # Só malhas GeoJSON (download rapido ~3s)
    uv run python -m data-pipeline.run --malhas

    # Só Gold (quando Silver ja existe)
    uv run python -m data-pipeline.run --gold
"""

import argparse
import gc
from pathlib import Path

from .bronze import salvar_bronze
from .config import settings
from .frota_gold import build_frota_municipio_ano
from .gold import (
    gerar_gold_custos,
    gerar_gold_obitos_ocorrencia,
    gerar_gold_obitos_residencia,
)
from .gold_timeseries import gerar_gold_diario
from .logging import get_logger, setup_logging
from .silver import processar_silver_sia, processar_silver_sim

logger = get_logger(__name__)


def run_sim_evidence(
    silver_path: Path,
    manifest_path: Path | None,
    gold_dir: Path,
    qa_output: Path,
) -> None:
    """Audita e materializa o contrato SIM-only sem baixar nem sobrescrever."""
    from .sim_evidence import auditar_snapshot_sim, materializar_marts_sim

    report = auditar_snapshot_sim(
        silver_path, manifest_path=manifest_path, output_path=qa_output
    )
    marts = materializar_marts_sim(silver_path, destino_dir=gold_dir)
    logger.info(
        "sim_evidence_concluido",
        resumo=report["summary"],
        marts={role: str(path) for role, path in marts.items()},
    )


def run_frota_gold() -> None:
    """Apenas Gold frota (CSV SENATRAN normalizado em data/frota/)."""
    logger.info("modo", tipo="frota_gold")
    out = build_frota_municipio_ano()
    if out:
        logger.info("frota_concluida", dest=str(out))
    else:
        logger.warning("frota_nao_gerada", motivo="csv_ausente")


def run_sample() -> None:
    """Pipeline com dados amostrais (offline, rapido)."""
    from .sample_data import gerar_sia, gerar_sim

    logger.info("modo", tipo="sample")
    df_sim = gerar_sim()
    df_sia = gerar_sia()
    _executar_etl(df_sim, df_sia)


def run_real(ufs: list[str], anos: list[int]) -> None:
    """Pipeline com dados reais do DATASUS (requer FTP)."""
    from .datasus import UFS_BRASIL, baixar_sia_streaming, baixar_sim_streaming

    if ufs == ["ALL"]:
        ufs = UFS_BRASIL
        logger.info("modo", tipo="real", escopo="brasil_completo", anos=anos)
    else:
        logger.info("modo", tipo="real", ufs=ufs, anos=anos)

    logger.info("etapa", sistema="sim", status="download_streaming")
    sim_bronze_dir = baixar_sim_streaming(ufs=ufs, anos=anos)

    logger.info("etapa", camada="silver_sim", status="iniciando")
    silver_sim = processar_silver_sim(sim_bronze_dir)
    logger.info("etapa", camada="silver_sim", status="concluido")
    gc.collect()

    logger.info("etapa", sistema="sia", status="download_streaming")
    sia_bronze_dir = baixar_sia_streaming(ufs=ufs, anos=anos)

    logger.info("etapa", camada="silver_sia", status="iniciando")
    silver_sia = processar_silver_sia(sia_bronze_dir)
    logger.info("etapa", camada="silver_sia", status="concluido")
    gc.collect()

    run_ibge()

    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos_ocorrencia = gerar_gold_obitos_ocorrencia(silver_sim)
    gold_obitos_residencia = gerar_gold_obitos_residencia(silver_sim)
    gold_custos = gerar_gold_custos(silver_sia)
    gold_diario = gerar_gold_diario(silver_sim, silver_sia)
    logger.info("etapa", camada="gold", status="concluido")

    logger.info(
        "pipeline_concluido",
        gold_obitos_ocorrencia=str(gold_obitos_ocorrencia),
        gold_obitos_residencia=str(gold_obitos_residencia),
        gold_custos=str(gold_custos),
        gold_diario=str(gold_diario),
    )


def run_ibge() -> None:
    """Baixa dados IBGE (localidades, populacao, malhas GeoJSON).

    Pode ser executado independentemente:
        uv run python -m data-pipeline.run --ibge
    """
    from .ibge_fetcher import salvar_ibge_parquet

    logger.info("etapa", camada="ibge", status="iniciando")
    ibge_dir = settings.resolve(settings.data_dir)
    salvar_ibge_parquet(ibge_dir)
    logger.info("etapa", camada="ibge", status="concluido")


def run_sim_only(ufs: list[str], anos: list[int]) -> None:
    """Pipeline completo para SIM apenas (Bronze -> Silver -> Gold), sem SIA.

    Uso:
        uv run python -m data-pipeline.run --sim-only --ufs ALL --anos 2010 2024

    Importante:
        Nao executa fetchers externos (IBGE/SIDRA). O enriquecimento deve ser
        rodado separadamente via `--ibge`, mantendo os pipelines desacoplados.
    """
    from .datasus import UFS_BRASIL, baixar_sim_streaming

    if ufs == ["ALL"]:
        ufs = UFS_BRASIL
        logger.info("modo", tipo="sim_only", escopo="brasil_completo", anos=anos)
    else:
        logger.info("modo", tipo="sim_only", ufs=ufs, anos=anos)

    logger.info("etapa", sistema="sim", status="download_streaming")
    sim_bronze_dir = baixar_sim_streaming(ufs=ufs, anos=anos)

    logger.info("etapa", camada="silver_sim", status="iniciando")
    silver_sim = processar_silver_sim(sim_bronze_dir)
    logger.info("etapa", camada="silver_sim", status="concluido")
    gc.collect()

    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos_ocorrencia = gerar_gold_obitos_ocorrencia(silver_sim)
    gold_obitos_residencia = gerar_gold_obitos_residencia(silver_sim)
    gold_diario = gerar_gold_diario(silver_sim, silver_sia=None)
    logger.info("etapa", camada="gold", status="concluido")

    logger.info(
        "pipeline_sim_only_concluido",
        gold_obitos_ocorrencia=str(gold_obitos_ocorrencia),
        gold_obitos_residencia=str(gold_obitos_residencia),
        gold_diario=str(gold_diario),
    )


def run_malhas() -> None:
    """Baixa apenas malhas GeoJSON do IBGE (~3.6MB, ~3s).

    Pode ser executado independentemente:
        uv run python -m data-pipeline.run --malhas
    """
    from .ibge_fetcher import baixar_malhas_geojson

    logger.info("etapa", camada="malhas_geojson", status="iniciando")
    dest = settings.resolve(settings.data_dir) / "ibge_malhas_municipios.geojson"
    path = baixar_malhas_geojson(dest)
    logger.info("etapa", camada="malhas_geojson", status="concluido", path=str(path))


def run_gold() -> None:
    """Gera apenas a camada Gold (requer Silver existente).

    Pode ser executado independentemente:
        uv run python -m data-pipeline.run --gold
    """
    silver_dir = settings.resolve(settings.silver_dir)
    silver_sim = silver_dir / "sim.parquet"
    silver_sia = silver_dir / "sia.parquet"

    if not silver_sim.exists() or not silver_sia.exists():
        logger.error(
            "silver_nao_encontrado",
            sim=str(silver_sim),
            sia=str(silver_sia),
            msg="Execute o pipeline completo primeiro",
        )
        return

    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos_ocorrencia = gerar_gold_obitos_ocorrencia(silver_sim)
    gold_obitos_residencia = gerar_gold_obitos_residencia(silver_sim)
    gold_custos = gerar_gold_custos(silver_sia)
    gold_diario = gerar_gold_diario(silver_sim, silver_sia)
    logger.info("etapa", camada="gold", status="concluido")

    logger.info(
        "pipeline_concluido",
        gold_obitos_ocorrencia=str(gold_obitos_ocorrencia),
        gold_obitos_residencia=str(gold_obitos_residencia),
        gold_custos=str(gold_custos),
        gold_diario=str(gold_diario),
    )


def _executar_etl(df_sim, df_sia) -> None:
    """Executa Bronze -> Silver -> Gold (modo classico, para sample data)."""
    logger.info("etapa", camada="bronze", status="iniciando")
    bronze_sim = salvar_bronze(df_sim, "sim")
    bronze_sia = salvar_bronze(df_sia, "sia")
    logger.info("etapa", camada="bronze", status="concluido")

    logger.info("etapa", camada="silver", status="iniciando")
    silver_sim = processar_silver_sim(bronze_sim)
    silver_sia = processar_silver_sia(bronze_sia)
    logger.info("etapa", camada="silver", status="concluido")

    run_ibge()

    logger.info("etapa", camada="gold", status="iniciando")
    gold_obitos_ocorrencia = gerar_gold_obitos_ocorrencia(silver_sim)
    gold_obitos_residencia = gerar_gold_obitos_residencia(silver_sim)
    gold_custos = gerar_gold_custos(silver_sia)
    gold_diario = gerar_gold_diario(silver_sim, silver_sia)
    logger.info("etapa", camada="gold", status="concluido")

    logger.info(
        "pipeline_concluido",
        gold_obitos_ocorrencia=str(gold_obitos_ocorrencia),
        gold_obitos_residencia=str(gold_obitos_residencia),
        gold_custos=str(gold_custos),
        gold_diario=str(gold_diario),
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
        "--ibge",
        action="store_true",
        help="Job de enriquecimento externo (IBGE): localidades + populacao + malhas",
    )
    parser.add_argument(
        "--malhas",
        action="store_true",
        help="Apenas malhas GeoJSON do IBGE (download rapido ~3s)",
    )
    parser.add_argument(
        "--gold",
        action="store_true",
        help="Apenas Gold (requer Silver existente)",
    )
    parser.add_argument(
        "--load-postgres",
        action="store_true",
        help="Carrega Parquet Gold/IBGE para PostgreSQL (requer DATABASE_URL)",
    )
    parser.add_argument(
        "--frota",
        action="store_true",
        help="Apenas Gold frota (data/frota/frota_normalizada_ibge.csv)",
    )
    parser.add_argument(
        "--sim-evidence",
        action="store_true",
        help="Audita/materializa Silver v2 SIM-only existente (sem download)",
    )
    parser.add_argument(
        "--silver-v2",
        type=Path,
        default=Path("data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet"),
        help="Silver v2 para --sim-evidence",
    )
    parser.add_argument(
        "--manifest-sim",
        type=Path,
        default=Path("data/silver/sim_v2_nacional_2010_2024.manifest.json"),
        help="Manifesto SIM para --sim-evidence",
    )
    parser.add_argument(
        "--qa-output",
        type=Path,
        default=Path("docs/metadata/sim_v2_nacional_2010_2024_contract_v2.audit.json"),
        help="Relat?rio QA para --sim-evidence",
    )
    parser.add_argument(
        "--sim-only",
        action="store_true",
        help="Apenas SIM (sem SIA) - pipeline completo Bronze->Silver->Gold",
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

    if args.sim_evidence:
        run_sim_evidence(
            silver_path=args.silver_v2,
            manifest_path=args.manifest_sim,
            gold_dir=settings.resolve(settings.gold_dir),
            qa_output=args.qa_output,
        )
    elif args.load_postgres:
        from .postgres_load import load_gold_to_postgres

        load_gold_to_postgres()
    elif args.frota:
        run_frota_gold()
    elif args.sim_only:
        run_sim_only(ufs=args.ufs, anos=args.anos)
    elif args.ibge:
        run_ibge()
    elif args.malhas:
        run_malhas()
    elif args.gold:
        run_gold()
    elif args.real:
        run_real(ufs=args.ufs, anos=args.anos)
    else:
        run_sample()


if __name__ == "__main__":
    main()
