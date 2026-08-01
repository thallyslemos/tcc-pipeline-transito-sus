"""Reconciliacao diagnostica entre a Silver v2 e ancoras oficiais versionadas."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

import duckdb

OFFICIAL_ANCHORS: tuple[dict[str, Any], ...] = (
    {
        "name": "RAG SESAB 2024",
        "year": 2023,
        "scope": "residencia_ba",
        "count": 2754,
        "snapshot": "SIM atualizado em 2025-01-10",
        "url": "https://www.ba.gov.br/saude/sites/site-sesab/files/migracao_2024/arquivos/wp-content/uploads/2025/10/RAG-2024-versao-final.pdf",
    },
    {
        "name": "RAG SESAB 2024",
        "year": 2024,
        "scope": "residencia_ba",
        "count": 2673,
        "snapshot": "SIM atualizado em 2025-01-10",
        "url": "https://www.ba.gov.br/saude/sites/site-sesab/files/migracao_2024/arquivos/wp-content/uploads/2025/10/RAG-2024-versao-final.pdf",
    },
    {
        "name": "Boletim SESAB ATT 2024",
        "year": 2023,
        "scope": "ocorrencia_ba",
        "count": 2723,
        "snapshot": "SIM preliminar; consulta 2024-09-11",
        "url": "https://www.ba.gov.br/saude/sites/site-sesab/files/migracao_2024/arquivos/wp-content/uploads/2017/11/boletinATT_No1_2024.pdf",
    },
    {
        "name": "Infografico SEI ATT 2025",
        "year": 2024,
        "scope": "ocorrencia_ba",
        "count": 2993,
        "snapshot": "extracao 2025-05-06",
        "url": "https://www.ba.gov.br/sei/sites/site-sei/files/migracao_2024/arquivos/images/publicacoes/infograficos/acidente_de_transito_2025.pdf",
    },
)


def observed_counts(silver_path: Path) -> dict[int, int]:
    """Conta ATT pelo UF do arquivo, que representa o recorte de residencia."""
    con = duckdb.connect(":memory:")
    try:
        rows = con.sql(
            f"""
            SELECT ano_obito, COUNT(*) AS total
            FROM read_parquet('{silver_path.as_posix()}')
            WHERE is_v01_v89 AND uf_arquivo = 'BA'
            GROUP BY ano_obito
            ORDER BY ano_obito
            """
        ).fetchall()
    finally:
        con.close()
    return {int(year): int(total) for year, total in rows if year is not None}


def reconcile(
    observed: dict[int, int],
    *,
    observed_scope: str = "residencia_ba_snapshot_local",
    anchors: tuple[dict[str, Any], ...] = OFFICIAL_ANCHORS,
) -> dict[str, Any]:
    """Produz diagnostico sem transformar divergencia de snapshot em falha."""
    comparisons: list[dict[str, Any]] = []
    for anchor in anchors:
        item = dict(anchor)
        local = observed.get(int(anchor["year"]))
        item["observed"] = local
        if anchor["scope"].startswith("ocorrencia"):
            item["comparability"] = "nao_comparavel_residencia_vs_ocorrencia"
        elif local is None:
            item["comparability"] = "ano_ausente"
        else:
            item["difference"] = local - int(anchor["count"])
            item["relative_difference"] = round(
                (local - int(anchor["count"])) / int(anchor["count"]), 6
            )
            item["comparability"] = "diagnostico_mesmo_conceito_snapshot_diferente"
        comparisons.append(item)
    return {
        "generated_at": date.today().isoformat(),
        "observed_scope": observed_scope,
        "observed": observed,
        "comparisons": comparisons,
        "decision": "nao_fixar_tolerancia_ate_reproduzir_TABNET_com_mesmo_snapshot",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--silver", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = reconcile(observed_counts(args.silver))
    payload = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload)


if __name__ == "__main__":
    main()
