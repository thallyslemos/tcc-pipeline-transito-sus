#!/usr/bin/env python3
"""
Script para executar o pipeline EDA completo.

Usa amostra sintética quando o download do DATASUS não está disponível.
Uso: python scripts/run_eda.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.logging_config import setup_logging

setup_logging(level="INFO", log_file=True)

import duckdb

from config.settings import BRONZE_DIR
from data_pipeline.extract import carregar_sim_bronze, gerar_amostra_sim
from data_pipeline.load import (
    carregar_gold_duckdb,
    exportar_parquet_gold,
    query_obitos_municipio,
)
from data_pipeline.transform import bronze_to_silver_sim, silver_to_gold_obitos


def main() -> int:
    """Executa pipeline EDA com amostra de dados."""
    # 1. Gera amostra (sintética para validação sem rede)
    sample_path = BRONZE_DIR / "sim_amostra_sintetica.parquet"
    if not sample_path.exists():
        df = gerar_amostra_sim(n_registros=5000)
        df.to_parquet(sample_path, index=False)
    else:
        df = carregar_sim_bronze(sample_path)

    # 2. Bronze -> Silver -> Gold
    silver = bronze_to_silver_sim(df)
    gold = silver_to_gold_obitos(silver)

    # 3. DuckDB
    conn = duckdb.connect(":memory:")
    carregar_gold_duckdb(conn, gold)

    # 4. Exemplo de consulta
    vc = query_obitos_municipio(conn, "2933307", ano=2023)
    total = vc["obitos"].sum() if len(vc) > 0 else 0
    print("Óbitos Vitória da Conquista 2023:", total)

    # 5. Exporta Gold
    exportar_parquet_gold(gold, "v_obitos_transito")
    print("Pipeline EDA concluído com sucesso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
