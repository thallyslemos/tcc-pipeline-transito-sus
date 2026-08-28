"""Materializa e audita os marts SIM-only do contrato de evid?ncia v1."""

from __future__ import annotations

import argparse
import json
from importlib import import_module
from pathlib import Path

sim_evidence = import_module("data-pipeline.sim_evidence")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--silver",
        type=Path,
        default=Path("data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet"),
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("data/silver/sim_v2_nacional_2010_2024.manifest.json"),
    )
    parser.add_argument("--gold-dir", type=Path, default=Path("data/gold"))
    parser.add_argument(
        "--qa-output",
        type=Path,
        default=Path("docs/metadata/sim_v2_nacional_2010_2024_contract_v2.audit.json"),
    )
    args = parser.parse_args()

    report = sim_evidence.auditar_snapshot_sim(
        args.silver, manifest_path=args.manifest, output_path=args.qa_output
    )
    marts = sim_evidence.materializar_marts_sim(args.silver, destino_dir=args.gold_dir)
    print(
        json.dumps(
            {
                "qa_output": str(args.qa_output),
                "summary": report["summary"],
                "marts": {role: str(path) for role, path in marts.items()},
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
