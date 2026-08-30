"""Carga idempotente Parquet Gold + IBGE para PostgreSQL.

Requer DATABASE_URL, schema aplicado (db/migrations) e Parquets gerados pelo ETL.
Modo idempotente: TRUNCATE das tabelas fact/dim seguido de INSERT em lotes.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg
from psycopg import sql

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

_OBITOS_COLS = [
    "cod_mun_ibge",
    "municipio",
    "uf",
    "competencia",
    "ano",
    "mes",
    "total_obitos",
    "tipo_veiculo",
    "faixa_etaria",
    "sexo",
    "lat",
    "lon",
    "populacao_estimada",
]

_CUSTOS_COLS = [
    "cod_mun_ibge",
    "municipio",
    "uf",
    "competencia",
    "ano",
    "mes",
    "custo_total",
    "total_procedimentos",
    "total_atendimentos",
    "tipo_veiculo",
    "faixa_etaria",
    "lat",
    "lon",
]

_SIM_MART_COLS = [
    "tipo_local",
    "cod_mun_ibge",
    "cod_mun_ibge_6",
    "municipio",
    "uf",
    "geografia_status",
    "competencia",
    "ano",
    "mes",
    "tipo_veiculo",
    "faixa_etaria",
    "sexo",
    "sexo_desc",
    "total_obitos",
    "registros_unicos",
    "populacao_estimada",
    "populacao_status",
    "taxa_obitos_100mil",
    "frota_total",
    "frota_status",
    "taxa_obitos_10mil_veiculos",
]


def _df_for_insert(df: pd.DataFrame, columns: list[str]) -> list[tuple[Any, ...]]:
    """Garante colunas na ordem esperada e converte tipos para psycopg.

    Substitui NaN/inf por None para colunas DOUBLE PRECISION (Postgres nao aceita nan)
    e np.nan por None para INTEGER/BIGINT. Usa np.where para construir arrays
    mistos com None nos valores problematicos.
    """
    import numpy as np

    missing = [c for c in columns if c not in df.columns]
    if missing:
        msg = f"Parquet sem colunas obrigatorias: {missing}"
        raise ValueError(msg)
    sub = df[columns].copy()
    if "competencia" in sub.columns:
        sub["competencia"] = pd.to_datetime(sub["competencia"]).dt.date

    for col in sub.columns:
        dtype = sub[col].dtype
        if dtype == "float64":
            values = sub[col].values
            mask = np.isnan(values) | np.isinf(values)
            sub[col] = pd.Series(np.where(mask, None, values), index=sub.index)
        elif pd.api.types.is_integer_dtype(dtype):
            values = sub[col].values
            mask = pd.isna(sub[col])
            sub[col] = pd.Series(np.where(mask, None, values), index=sub.index)

    return list(sub.itertuples(index=False, name=None))


def _truncate_facts(cur: Any, schema: str) -> None:
    schema_id = sql.Identifier(schema)
    cur.execute(
        sql.SQL(
            "TRUNCATE TABLE {}.gold_sim_obitos_ocorrencia, {}.gold_sim_obitos_residencia, "
            "{}.gold_obitos_ocorrencia, {}.gold_obitos_residencia, "
            "{}.gold_custos, {}.dim_ibge_municipio, {}.dim_ibge_populacao"
        ).format(
            schema_id,
            schema_id,
            schema_id,
            schema_id,
            schema_id,
            schema_id,
            schema_id,
        )
    )


_ALLOWED_TABLES = frozenset(
    {
        "gold_sim_obitos_ocorrencia",
        "gold_sim_obitos_residencia",
        "gold_obitos_ocorrencia",
        "gold_obitos_residencia",
        "gold_custos",
        "dim_ibge_municipio",
        "dim_ibge_populacao",
    }
)


def _insert_batch(cur: Any, schema: str, table: str, columns: list[str], rows: list[tuple]) -> None:
    if not rows:
        return
    if table not in _ALLOWED_TABLES:
        msg = f"Tabela não permitida na carga: {table}"
        raise ValueError(msg)
    fq = sql.SQL("{}.{}").format(sql.Identifier(schema), sql.Identifier(table))
    cols = sql.SQL(", ").join(sql.Identifier(c) for c in columns)
    placeholders = sql.SQL(", ").join([sql.Placeholder()] * len(columns))
    insert_q = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(fq, cols, placeholders)
    cur.executemany(insert_q, rows)


def load_gold_to_postgres(
    dsn: str | None = None,
    schema: str | None = None,
    gold_dir: Path | None = None,
    data_dir: Path | None = None,
) -> None:
    """Carrega Parquets para PostgreSQL (TRUNCATE + INSERT)."""
    dsn = dsn or os.environ.get("DATABASE_URL") or getattr(settings, "database_url", None)
    if not dsn:
        msg = "Defina DATABASE_URL ou settings.database_url"
        raise ValueError(msg)

    schema = (
        schema
        or os.environ.get("POSTGRES_SCHEMA")
        or getattr(settings, "postgres_schema", "public")
    )
    gold_dir = gold_dir or settings.resolve(settings.gold_dir)
    data_dir = data_dir or settings.resolve(settings.data_dir)

    paths = {
        "gold_sim_obitos_ocorrencia": gold_dir
        / "sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet",
        "gold_sim_obitos_residencia": gold_dir
        / "sim_v1_obitos_municipio_mes_residencia_v2.parquet",
        "gold_obitos_ocorrencia": gold_dir / "obitos_ocorrencia_municipio_mes.parquet",
        "gold_obitos_residencia": gold_dir / "obitos_residencia_municipio_mes.parquet",
        "gold_custos": gold_dir / "custos_municipio_mes.parquet",
        "dim_ibge_municipio": data_dir / "ibge_municipios.parquet",
        "dim_ibge_populacao": data_dir / "ibge_populacao.parquet",
    }

    legacy_obitos = gold_dir / "obitos_municipio_mes.parquet"
    if not paths["gold_obitos_ocorrencia"].exists() and legacy_obitos.exists():
        paths["gold_obitos_ocorrencia"] = legacy_obitos

    with psycopg.connect(dsn, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(schema)))
            _truncate_facts(cur, schema)

            if paths["gold_sim_obitos_ocorrencia"].exists():
                df = pd.read_parquet(paths["gold_sim_obitos_ocorrencia"])
                rows = _df_for_insert(df, _SIM_MART_COLS)
                _insert_batch(cur, schema, "gold_sim_obitos_ocorrencia", _SIM_MART_COLS, rows)
                logger.info("postgres_load_sim_ocorrencia", linhas=len(rows))
            else:
                logger.warning("postgres_load_skip", tabela="gold_sim_obitos_ocorrencia")

            if paths["gold_sim_obitos_residencia"].exists():
                df = pd.read_parquet(paths["gold_sim_obitos_residencia"])
                rows = _df_for_insert(df, _SIM_MART_COLS)
                _insert_batch(cur, schema, "gold_sim_obitos_residencia", _SIM_MART_COLS, rows)
                logger.info("postgres_load_sim_residencia", linhas=len(rows))
            else:
                logger.warning("postgres_load_skip", tabela="gold_sim_obitos_residencia")

            if paths["gold_obitos_ocorrencia"].exists():
                df = pd.read_parquet(paths["gold_obitos_ocorrencia"])
                rows = _df_for_insert(df, _OBITOS_COLS)
                _insert_batch(cur, schema, "gold_obitos_ocorrencia", _OBITOS_COLS, rows)
                logger.info("postgres_load_obitos_ocorrencia", linhas=len(rows))
            else:
                logger.warning("postgres_load_skip", tabela="gold_obitos_ocorrencia")

            if paths["gold_obitos_residencia"].exists():
                df = pd.read_parquet(paths["gold_obitos_residencia"])
                rows = _df_for_insert(df, _OBITOS_COLS)
                _insert_batch(cur, schema, "gold_obitos_residencia", _OBITOS_COLS, rows)
                logger.info("postgres_load_obitos_residencia", linhas=len(rows))
            else:
                logger.warning("postgres_load_skip", tabela="gold_obitos_residencia")

            if paths["gold_custos"].exists():
                df = pd.read_parquet(paths["gold_custos"])
                rows = _df_for_insert(df, _CUSTOS_COLS)
                _insert_batch(cur, schema, "gold_custos", _CUSTOS_COLS, rows)
                logger.info("postgres_load_custos", linhas=len(rows))
            else:
                logger.warning("postgres_load_skip", tabela="gold_custos")

            if paths["dim_ibge_municipio"].exists():
                df = pd.read_parquet(paths["dim_ibge_municipio"])
                if "nome" not in df.columns and "municipio" in df.columns:
                    df = df.rename(columns={"municipio": "nome"})
                cols = ["cod_mun_ibge", "nome", "uf", "regiao", "lat", "lon"]
                rows = _df_for_insert(df, cols)
                _insert_batch(cur, schema, "dim_ibge_municipio", cols, rows)
                logger.info("postgres_load_dim_municipio", linhas=len(rows))

            if paths["dim_ibge_populacao"].exists():
                df = pd.read_parquet(paths["dim_ibge_populacao"])
                cols = ["cod_mun_ibge", "ano", "populacao"]
                rows = _df_for_insert(df, cols)
                _insert_batch(cur, schema, "dim_ibge_populacao", cols, rows)
                logger.info("postgres_load_dim_populacao", linhas=len(rows))

        conn.commit()
    logger.info("postgres_load_concluido", schema=schema)
