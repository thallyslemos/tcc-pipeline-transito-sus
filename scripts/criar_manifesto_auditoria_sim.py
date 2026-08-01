"""Cria manifesto somente de leitura para uma visao canonica do Bronze SIM."""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


PART_RE = re.compile(r"sim_([A-Z]{2})_(\d{4})_(\d+)\.parquet$")


def construir_manifesto(
    bronze_dir: Path,
    manifesto_path: Path,
    *,
    ufs: list[str],
    anos: range,
) -> Path:
    """Seleciona uma copia por hash e registra todas as versoes distintas."""
    manifest_mod = import_module("data-pipeline.ingestion_manifest")
    import duckdb

    candidates: dict[tuple[str, int, str], list[Path]] = defaultdict(list)
    for path in sorted(bronze_dir.glob("sim_*.parquet")):
        match = PART_RE.fullmatch(path.name)
        if match is None:
            continue
        uf, year, _index = match.groups()
        if uf not in ufs or int(year) not in anos:
            continue
        fingerprint = manifest_mod.file_fingerprint(path)
        candidates[(uf, int(year), fingerprint["sha256"])].append(path)

    store = manifest_mod.ManifestStore(manifesto_path)
    for (uf, year, digest), paths in sorted(candidates.items()):
        del digest
        path = paths[0]
        source = {"path": f"legacy://{path.name}"}
        identity = manifest_mod.source_identity(
            "SIM", uf, year, source, client="local_legacy", group="CID10"
        )
        con = duckdb.connect(":memory:")
        try:
            row_count = con.sql(
                f"SELECT COUNT(*) FROM read_parquet('{path.as_posix()}')"
            ).fetchone()[0]
        finally:
            con.close()
        store.register(
            {
                "source_identity": identity,
                "source_reference": source["path"],
                "client": "local_legacy",
                "dataset": "SIM",
                "group": "CID10",
                "uf": uf,
                "year": year,
                "target_path": path.name,
                "fingerprint": manifest_mod.file_fingerprint(path),
                "row_count": int(row_count),
                "duplicate_copies": len(paths),
                "status": "approved",
            }
        )
    return manifesto_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bronze-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--ufs", default="BA")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-year", type=int, default=2024)
    args = parser.parse_args()
    construir_manifesto(
        args.bronze_dir,
        args.manifest,
        ufs=[uf.strip().upper() for uf in args.ufs.split(",") if uf.strip()],
        anos=range(args.start_year, args.end_year + 1),
    )
    print(args.manifest)


if __name__ == "__main__":
    main()
