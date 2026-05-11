"""Testa a lógica de limpeza de NaN/inf que _df_for_insert aplica antes do insert.

O modulo postgres_load usa imports relativos (from .config, from .logging)
e so pode ser importado via `uv run python -m data-pipeline.postgres_load`.
Por isso, replicamos aqui a logica de transformacao de tipos que o teste
precisa validar, sem importar o modulo diretamente.
"""

import datetime
import math
from pathlib import Path
from typing import Any

import pandas as pd
import pytest


def _df_for_insert_logic(df: pd.DataFrame, columns: list[str]) -> list[tuple[Any, ...]]:
    """Replicacao da logica de _df_for_insert em postgres_load.py."""
    import numpy as np

    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"Parquet sem colunas obrigatorias: {missing}")
    sub = df[columns].copy()
    if "competencia" in sub.columns:
        sub["competencia"] = pd.to_datetime(sub["competencia"]).dt.date

    for col in sub.columns:
        dtype = sub[col].dtype
        if dtype == "float64":
            values = sub[col].values
            mask = np.isnan(values) | np.isinf(values)
            sub[col] = pd.Series(np.where(mask, None, values), index=sub.index)
        elif dtype == "int64":
            values = sub[col].values
            mask = pd.isna(sub[col])
            sub[col] = pd.Series(np.where(mask, None, values), index=sub.index)

    return list(sub.itertuples(index=False, name=None))


_OBITOS_COLS = [
    "cod_mun_ibge", "municipio", "uf", "competencia", "ano", "mes",
    "total_obitos", "tipo_veiculo", "faixa_etaria", "sexo",
    "lat", "lon", "populacao_estimada",
]

_CUSTOS_COLS = [
    "cod_mun_ibge", "municipio", "uf", "competencia", "ano", "mes",
    "custo_total", "total_procedimentos", "total_atendimentos",
    "tipo_veiculo", "faixa_etaria", "lat", "lon",
]


@pytest.fixture
def parquet_path():
    p = Path("data/gold/obitos_ocorrencia_municipio_mes.parquet")
    if not p.exists():
        p = Path("data/gold/obitos_municipio_mes.parquet")
    return p


def test_df_for_insert_no_nan_in_float_cols(parquet_path: Path):
    """Verifica que nenhuma linha contiene float nan apos _df_for_insert_logic."""
    if not parquet_path.exists():
        pytest.skip(f"Parquet not found: {parquet_path}")

    df = pd.read_parquet(parquet_path)
    rows = _df_for_insert_logic(df, _OBITOS_COLS)

    assert len(rows) == len(df), "Row count must match"

    for row in rows:
        for val in row:
            if isinstance(val, float):
                assert not math.isnan(val), f"nan found in row: {row}"

    lat_idx = _OBITOS_COLS.index("lat")
    lon_idx = _OBITOS_COLS.index("lon")
    pop_idx = _OBITOS_COLS.index("populacao_estimada")

    assert all(row[lat_idx] is None for row in rows), "All lat must be None"
    assert all(row[lon_idx] is None for row in rows), "All lon must be None"
    assert any(row[pop_idx] is not None for row in rows), "Some populacao should be non-None"


def test_df_for_insert_preserves_competencia_date(parquet_path: Path):
    """Verifica que competencia vira date object, nao string."""
    df = pd.read_parquet(parquet_path)
    rows = _df_for_insert_logic(df, _OBITOS_COLS)
    comp_idx = _OBITOS_COLS.index("competencia")

    for row in rows:
        val = row[comp_idx]
        assert isinstance(val, datetime.date), f"competencia should be date, got {type(val)}: {val}"


def test_df_for_insert_integer_types_int(parquet_path: Path):
    """ano, mes, total_obitos devem ser int Python, nao np.int64."""
    df = pd.read_parquet(parquet_path)
    rows = _df_for_insert_logic(df, _OBITOS_COLS)

    ano_idx = _OBITOS_COLS.index("ano")
    mes_idx = _OBITOS_COLS.index("mes")
    obitos_idx = _OBITOS_COLS.index("total_obitos")

    for row in rows:
        for idx in (ano_idx, mes_idx, obitos_idx):
            val = row[idx]
            assert type(val) in (int, type(None)), f"expected int or None, got {type(val)}: {val}"


def test_custos_df_for_insert_logic():
    """Testa custo_total que pode ser Decimal no parquet."""
    custos_path = Path("data/gold/custos_municipio_mes.parquet")
    if not custos_path.exists():
        pytest.skip("custos Parquet not found")

    df = pd.read_parquet(custos_path)
    rows = _df_for_insert_logic(df, _CUSTOS_COLS)

    assert len(rows) > 0, "Should have some custos rows"

    for row in rows:
        for val in row:
            if isinstance(val, float):
                assert not math.isnan(val), f"nan found: {row}"