#!/usr/bin/env python3
"""POC local TimesFM — previsao mensal vs consolidado e preliminares 2025.

Uso (requer dados Gold materializados):
  uv run python analysis/timesfm_poc.py --uf BA --cod-mun 2927408
  uv run python analysis/timesfm_poc.py --uf BA --list-top 5

Notas:
- O backend em producao usa TimesFM 1.0 (`google/timesfm-1.0-200m-pytorch`).
- TimesFM 3 deve ser avaliado separadamente (compatibilidade com pacote `timesfm`).
- Este script NAO altera a API; gera metricas no stdout para decisao de prod.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import duckdb  # noqa: E402

GOLD_OCORRENCIA = ROOT / "data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet"
GOLD_PRELIM = ROOT / "data/gold/sim_prelim_municipio_mes_ocorrencia.parquet"


def _serie_municipal(con: duckdb.DuckDBPyConnection, cod_mun: str) -> list[tuple[str, int]]:
    rows = con.sql(
        f"""
        SELECT CAST(competencia AS VARCHAR) AS competencia, SUM(total_obitos)::INT AS obitos
        FROM read_parquet('{GOLD_OCORRENCIA.as_posix()}')
        WHERE LEFT(CAST(cod_mun_ibge AS VARCHAR), 6) = '{cod_mun[:6]}'
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchall()
    return [(str(c), int(o)) for c, o in rows]


def _prelim_2025(
    con: duckdb.DuckDBPyConnection,
    cod_mun: str | None,
    uf: str | None,
) -> list[tuple[str, int]]:
    if not GOLD_PRELIM.exists():
        return []
    where = ["ano = 2025"]
    if cod_mun:
        where.append(f"LEFT(CAST(cod_mun_ibge AS VARCHAR), 6) = '{cod_mun[:6]}'")
    if uf:
        where.append(f"uf = '{uf}'")
    clause = " AND ".join(where)
    rows = con.sql(
        f"""
        SELECT CAST(competencia AS VARCHAR) AS competencia, SUM(total_obitos)::INT AS obitos
        FROM read_parquet('{GOLD_PRELIM.as_posix()}')
        WHERE {clause}
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchall()
    return [(str(c), int(o)) for c, o in rows]


def _mape(actual: list[int], predicted: list[int]) -> float | None:
    if not actual or not predicted or len(actual) != len(predicted):
        return None
    errs = [abs(a - p) / a for a, p in zip(actual, predicted, strict=True) if a > 0]
    return sum(errs) / len(errs) if errs else None


def run_forecast(series: list[int], horizon: int = 12) -> list[float] | None:
    """Tenta TimesFM 1.0 via backend.services.forecaster; None se indisponivel."""
    if len(series) < 12:
        return None
    try:
        import numpy as np
        from backend.services.forecaster import _get_model

        model = _get_model()
        values = np.array([series], dtype=np.float32)
        point_forecast, _ = model.forecast(values, freq=[0])
        return [max(0.0, float(v)) for v in point_forecast[0].tolist()[:horizon]]
    except Exception as exc:
        print(f"[warn] TimesFM indisponivel: {exc}", file=sys.stderr)
        return None


def backtest_holdout(series: list[tuple[str, int]], holdout: int = 12) -> dict:
    if len(series) <= holdout + 12:
        return {"status": "insuficiente", "n": len(series)}
    train = [o for _, o in series[:-holdout]]
    test = [o for _, o in series[-holdout:]]
    pred = run_forecast(train, horizon=holdout)
    baseline = [sum(train[-12:]) / 12] * holdout
    return {
        "status": "ok",
        "n_train": len(train),
        "n_test": holdout,
        "mape_timesfm": _mape(test, pred) if pred else None,
        "mape_baseline_media_12m": _mape(test, baseline),
        "test_total": sum(test),
        "pred_total": round(sum(pred), 1) if pred else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="POC TimesFM local")
    parser.add_argument("--uf", default="BA")
    parser.add_argument("--cod-mun", help="Codigo IBGE 6-7 digitos")
    parser.add_argument(
        "--list-top",
        type=int,
        default=0,
        help="Listar N municipios com mais obitos em 2024",
    )
    args = parser.parse_args()

    if not GOLD_OCORRENCIA.exists():
        print(
            json.dumps({"erro": f"Gold ausente: {GOLD_OCORRENCIA}"}, ensure_ascii=False, indent=2)
        )
        sys.exit(1)

    con = duckdb.connect(":memory:")

    if args.list_top:
        rows = con.sql(
            f"""
            SELECT LEFT(CAST(cod_mun_ibge AS VARCHAR), 6) AS cod6,
                   MAX(municipio) AS municipio,
                   SUM(total_obitos)::INT AS obitos
            FROM read_parquet('{GOLD_OCORRENCIA.as_posix()}')
            WHERE ano = 2024 AND uf = '{args.uf}'
            GROUP BY 1
            ORDER BY obitos DESC
            LIMIT {args.list_top}
            """
        ).fetchall()
        payload = [{"cod_mun": r[0], "municipio": r[1], "obitos_2024": r[2]} for r in rows]
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    cod = args.cod_mun
    if not cod:
        print("Informe --cod-mun ou --list-top", file=sys.stderr)
        sys.exit(2)

    serie = _serie_municipal(con, cod)
    bt = backtest_holdout(serie)
    prelim = _prelim_2025(con, cod, args.uf if not cod else None)

    train_vals = [o for comp, o in serie if int(str(comp)[:4]) <= 2024]
    forecast_2025 = run_forecast(train_vals, horizon=12) if len(train_vals) >= 12 else None

    out = {
        "cod_mun": cod[:6],
        "uf": args.uf,
        "serie_mensal_pontos": len(serie),
        "backtest_holdout_12m": bt,
        "prelim_2025_meses": len(prelim),
        "prelim_2025_total": sum(o for _, o in prelim),
        "forecast_2025_total": round(sum(forecast_2025), 1) if forecast_2025 else None,
        "notas": [
            "Comparar forecast_2025_total com prelim_2025_total apenas como ordem de grandeza.",
            "Preliminares crescem por captacao — usar /api/sim/prelim/completude para maturidade.",
            "Proximo passo: avaliar checkpoint TimesFM 3 vs 1.0 neste mesmo script.",
        ],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
