"""Inventário somente leitura do catálogo SIM exposto pelo PySUS 2.x."""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable, Mapping

SIM_YEARS = tuple(range(2010, 2025))


def summarize_catalog_rows(
    rows: Iterable[Mapping[str, object]],
    expected_years: Iterable[int] = SIM_YEARS,
) -> dict[str, object]:
    """Resume anos/arquivos observados sem presumir que o catálogo seja completo."""
    records = [dict(row) for row in rows]
    observed_years = sorted({int(row["year"]) for row in records if row.get("year") is not None})
    expected = sorted({int(year) for year in expected_years})
    return {
        "rows": len(records),
        "observed_years": observed_years,
        "missing_years": sorted(set(expected) - set(observed_years)),
        "unexpected_years": sorted(set(observed_years) - set(expected)),
        "files": records,
    }


def list_sim_catalog(
    state: str,
    years: Iterable[int] = SIM_YEARS,
    client: str = "ftp",
) -> dict[str, object]:
    """Consulta o inventário PySUS; falha explicitamente em versões antigas."""
    try:
        from pysus import list_files
    except ImportError as exc:
        return {
            "status": "unavailable",
            "reason": "PySUS 2.x com list_files não está instalado",
            "error": str(exc),
        }

    frame = list_files("SIM", client=client, state=state, year=list(years))
    return {
        "status": "ok",
        "client": client,
        "state": state,
        **summarize_catalog_rows(frame.to_dict("records")),
    }


def main() -> None:
    """Executa o inventário solicitado e imprime JSON na saída padrão."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", default="BA")
    parser.add_argument("--client", default="ftp")
    args = parser.parse_args()
    print(
        json.dumps(
            list_sim_catalog(args.state.upper(), client=args.client),
            ensure_ascii=False,
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
