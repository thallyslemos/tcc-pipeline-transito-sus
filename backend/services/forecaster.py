"""Serviço de previsão de séries temporais com TimesFM (Google Research).

Carrega o modelo google/timesfm-1.0-200m-pytorch em CPU e fornece
previsões de 12 meses para óbitos ou custos por município.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

import numpy as np
import structlog

from ..database import get_connection

logger = structlog.get_logger(__name__)

_model = None
_model_loading = False

MIN_HISTORY_MONTHS = 12
HORIZON = 12
QUANTILES = (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)


def _get_model():
    """Carrega o modelo TimesFM singleton (lazy loading)."""
    global _model, _model_loading
    if _model is not None:
        return _model
    if _model_loading:
        msg = "Modelo TimesFM ainda carregando. Tente novamente em alguns segundos."
        raise RuntimeError(msg)

    _model_loading = True
    try:
        import timesfm

        logger.info("timesfm_carregando", modelo="google/timesfm-1.0-200m-pytorch")
        hparams = timesfm.TimesFmHparams(
            context_len=512,
            horizon_len=HORIZON,
            per_core_batch_size=32,
            backend="cpu",
            quantiles=QUANTILES,
        )
        checkpoint = timesfm.TimesFmCheckpoint(
            version="torch",
            huggingface_repo_id="google/timesfm-1.0-200m-pytorch",
        )
        tfm = timesfm.TimesFm(hparams=hparams, checkpoint=checkpoint)
        tfm.load_from_checkpoint(checkpoint)
        logger.info("timesfm_carregado")
        _model = tfm
        return _model
    except Exception:
        _model_loading = False
        raise


def _query_series(
    metrica: Literal["obitos", "custos"],
    cod_mun_ibge: str,
) -> list[dict]:
    """Extrai série histórica mensal do DuckDB para um município."""
    con = get_connection()

    cod6 = cod_mun_ibge[:6]
    if metrica == "obitos":
        rows = con.sql(f"""
            SELECT
                competencia,
                SUM(total_obitos) AS valor
            FROM v_obitos
            WHERE LEFT(cod_mun_ibge, 6) = '{cod6}'
            GROUP BY competencia
            ORDER BY competencia
        """).fetchall()
    else:
        rows = con.sql(f"""
            SELECT
                competencia,
                ROUND(SUM(custo_total), 2) AS valor
            FROM v_custos
            WHERE LEFT(cod_mun_ibge, 6) = '{cod6}'
            GROUP BY competencia
            ORDER BY competencia
        """).fetchall()

    return [{"competencia": row[0], "valor": float(row[1])} for row in rows]


def _municipio_nome(cod_mun_ibge: str) -> str | None:
    """Retorna o nome do município a partir do DuckDB."""
    con = get_connection()
    cod6 = cod_mun_ibge[:6]
    row = con.sql(f"""
        SELECT DISTINCT municipio FROM v_obitos
        WHERE LEFT(cod_mun_ibge, 6) = '{cod6}' LIMIT 1
    """).fetchone()
    return row[0] if row else None


def _next_months(last_date: date, n: int) -> list[str]:
    """Gera as próximas n competências mensais a partir de last_date."""
    result = []
    year, month = last_date.year, last_date.month
    for _ in range(n):
        month += 1
        if month > 12:
            month = 1
            year += 1
        result.append(f"{year}-{month:02d}")
    return result


def forecast(
    metrica: Literal["obitos", "custos"],
    cod_mun_ibge: str,
) -> dict:
    """Executa previsão TimesFM para um município.

    Returns:
        dict com historico, previsao, intervalos de confiança e metadados.

    Raises:
        ValueError: se não houver dados históricos suficientes.
    """
    series = _query_series(metrica, cod_mun_ibge)

    if len(series) < MIN_HISTORY_MONTHS:
        msg = (
            f"Historico insuficiente para {cod_mun_ibge}: "
            f"{len(series)} meses (minimo {MIN_HISTORY_MONTHS})."
        )
        raise ValueError(msg)

    nome = _municipio_nome(cod_mun_ibge)
    values = np.array([s["valor"] for s in series], dtype=np.float32)
    dates = [s["competencia"] for s in series]

    model = _get_model()
    point_forecast, quantile_forecast = model.forecast(
        [values],
        freq=[0],
    )

    point = point_forecast[0].tolist()
    q_all = quantile_forecast[0]

    q10_idx = list(QUANTILES).index(0.1)
    q90_idx = list(QUANTILES).index(0.9)
    lower = q_all[:, q10_idx].tolist()
    upper = q_all[:, q90_idx].tolist()

    raw_last = dates[-1]
    last_date = raw_last if isinstance(raw_last, date) else date.fromisoformat(str(raw_last)[:10])
    future_dates = _next_months(last_date, HORIZON)

    if metrica == "obitos":
        point = [max(0, round(v)) for v in point]
        lower = [max(0, round(v)) for v in lower]
        upper = [max(0, round(v)) for v in upper]
    else:
        point = [max(0, round(v, 2)) for v in point]
        lower = [max(0, round(v, 2)) for v in lower]
        upper = [max(0, round(v, 2)) for v in upper]

    historico = [
        {"competencia": str(d)[:7], "valor": float(v)}
        for d, v in zip(dates, values, strict=True)
    ]

    previsao = [
        {
            "competencia": future_dates[i],
            "valor": point[i],
            "lower": lower[i],
            "upper": upper[i],
        }
        for i in range(HORIZON)
    ]

    return {
        "cod_mun_ibge": cod_mun_ibge,
        "municipio": nome,
        "metrica": metrica,
        "horizon": HORIZON,
        "historico_meses": len(series),
        "historico": historico,
        "previsao": previsao,
    }
