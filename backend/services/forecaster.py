"""Serviço de previsão de séries temporais com TimesFM (Google Research).

Carrega o modelo google/timesfm-1.0-200m-pytorch em CPU e fornece
previsões de 12 meses para óbitos ou custos por município.
"""

from __future__ import annotations

import threading
from datetime import date
from typing import Literal

import numpy as np
import structlog

from ..database import get_connection
from ..sql_dialect import expr_round_numeric

logger = structlog.get_logger(__name__)

_model = None
_model_loading = False
_model_lock = threading.Lock()

MIN_HISTORY_MONTHS = 12
HORIZON = 12
QUANTILES = (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)


def _get_model():
    """Carrega o modelo TimesFM singleton (lazy loading)."""
    global _model, _model_loading
    if _model is not None:
        return _model
    with _model_lock:
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
        rows = (
            con.execute(
                """
                SELECT competencia, SUM(total_obitos) AS valor
                FROM v_obitos
                WHERE LEFT(cod_mun_ibge, 6) = ?
                GROUP BY competencia ORDER BY competencia
            """,
                [cod6],
            )
            .fetchdf()
            .to_dict(orient="records")
        )
    else:
        rows = (
            con.execute(
                f"""
                SELECT competencia, {expr_round_numeric("SUM(custo_total)")} AS valor
                FROM v_custos
                WHERE LEFT(cod_mun_ibge, 6) = ?
                GROUP BY competencia ORDER BY competencia
            """,
                [cod6],
            )
            .fetchdf()
            .to_dict(orient="records")
        )

    return [{"competencia": row["competencia"], "valor": float(row["valor"])} for row in rows]


def _municipio_nome(cod_mun_ibge: str) -> str | None:
    """Retorna o nome do município a partir do DuckDB."""
    con = get_connection()
    cod6 = cod_mun_ibge[:6]
    row = con.execute(
        "SELECT DISTINCT municipio FROM v_obitos WHERE LEFT(cod_mun_ibge, 6) = ? LIMIT 1",
        [cod6],
    ).fetchone()
    return row[0] if row else None


def _extract_year(competencia) -> int:
    """Extrai o ano de uma competência (date, datetime ou string)."""
    if isinstance(competencia, (date,)):
        return competencia.year
    s = str(competencia)[:4]
    return int(s)


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
    ano_inicio: int | None = None,
    ano_fim: int | None = None,
) -> dict:
    """Executa previsão TimesFM para um município.

    Args:
        metrica: "obitos" ou "custos".
        cod_mun_ibge: Código IBGE do município.
        ano_inicio: Ano inicial do histórico (inclusive). Se None, usa todo o histórico.
        ano_fim: Ano final do histórico (inclusive). Se None, usa todo o histórico.

    Returns:
        dict com historico, previsao, intervalos de confiança e metadados.

    Raises:
        ValueError: se não houver dados históricos suficientes.
    """
    series = _query_series(metrica, cod_mun_ibge)

    if ano_inicio or ano_fim:
        series = [
            s
            for s in series
            if (ano_inicio is None or _extract_year(s["competencia"]) >= ano_inicio)
            and (ano_fim is None or _extract_year(s["competencia"]) <= ano_fim)
        ]

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
        {"competencia": str(d)[:7], "valor": float(v)} for d, v in zip(dates, values, strict=True)
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
