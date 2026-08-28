"""Gera camada Gold de frota municipal (SENATRAN pré-normalizado com IBGE).

Entrada esperada (CSV): colunas mínimas
  - cod_mun_ibge: código 6 ou 7 dígitos
  - ano: ano de referência (ex.: frota em dezembro/2024 → ano 2024)
  - quantidade: número de veículos

Opcional: tipo_veiculo — todas as linhas são somadas em frota_total.
"""

from __future__ import annotations

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

DEFAULT_BRONZE_CSV = "data/frota/frota_normalizada_ibge.csv"
GOLD_FILENAME = "frota_municipio_ano.parquet"


def build_frota_municipio_ano(
    bronze_csv: Path | None = None,
    dest: Path | None = None,
) -> Path | None:
    """Agrega frota por município (6 dígitos) e ano; grava Parquet Gold.

    Returns:
        Caminho do Parquet criado, ou None se o CSV de entrada não existir.
    """
    src = bronze_csv or settings.resolve(DEFAULT_BRONZE_CSV)
    out = dest or (settings.resolve(settings.gold_dir) / GOLD_FILENAME)

    if not src.exists():
        logger.warning("frota_bronze_ausente", path=str(src))
        return None

    out.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT
                CASE
                    WHEN LENGTH(c) >= 7 THEN SUBSTR(c, 1, 6)
                    WHEN LENGTH(c) = 6 THEN c
                    ELSE LPAD(c, 6, '0')
                END AS cod_mun_ibge,
                CAST(ano AS INTEGER) AS ano,
                SUM(CAST(quantidade AS BIGINT)) AS frota_total
            FROM (
                SELECT
                    REGEXP_REPLACE(TRIM(CAST(cod_mun_ibge AS VARCHAR)), '[^0-9]', '', 'g') AS c,
                    ano,
                    quantidade
                FROM read_csv_auto('{src}')
            ) raw
            WHERE c <> ''
            GROUP BY 1, 2
            ORDER BY 1, 2
        ) TO '{out}' (FORMAT PARQUET)
    """)
    n = con.sql(f"SELECT COUNT(*) FROM read_parquet('{out}')").fetchone()[0]
    logger.info("frota_gold_escrita", dest=str(out), linhas=int(n))
    return out
