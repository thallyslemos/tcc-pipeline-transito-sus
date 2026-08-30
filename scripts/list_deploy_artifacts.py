"""Valida artefatos Parquet/GeoJSON necessarios para deploy DuckDB na VPS."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    ("data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet", "Mart SIM ocorrencia"),
    ("data/gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet", "Mart SIM residencia"),
    ("data/ibge_municipios.parquet", "Dimensao municipal IBGE"),
    ("data/ibge_populacao.parquet", "Populacao IBGE"),
    ("data/ibge_malhas_municipios.geojson", "Malha GeoJSON (mapa)"),
]

OPTIONAL = [
    ("data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet", "Silver v2 (fluxos/temporal)"),
    ("data/gold/sim_prelim_municipio_mes_ocorrencia.parquet", "Preliminares ocorrencia"),
    ("data/gold/sim_prelim_municipio_mes_residencia.parquet", "Preliminares residencia"),
    ("data/gold/frota_municipio_ano.parquet", "Frota SENATRAN"),
]


@dataclass
class ArtifactStatus:
    rel_path: str
    label: str
    path: Path
    present: bool
    size_bytes: int


def _check(rel_path: str, label: str) -> ArtifactStatus:
    path = PROJECT_ROOT / rel_path
    present = path.is_file()
    size = path.stat().st_size if present else 0
    return ArtifactStatus(rel_path, label, path, present, size)


def _fmt_size(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f} MB"
    if n >= 1_000:
        return f"{n / 1_000:.1f} KB"
    return f"{n} B"


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida artefatos para deploy VPS (DuckDB)")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exige tambem os artefatos opcionais (conjunto completo)",
    )
    args = parser.parse_args()

    required_status = [_check(path, label) for path, label in REQUIRED]
    optional_status = [_check(path, label) for path, label in OPTIONAL]

    missing_required = [s for s in required_status if not s.present]
    missing_optional = [s for s in optional_status if not s.present]

    print("Artefatos obrigatorios:")
    for s in required_status:
        mark = "OK" if s.present else "FALTA"
        size = _fmt_size(s.size_bytes) if s.present else "-"
        print(f"  [{mark}] {s.rel_path} ({size}) — {s.label}")

    print("\nArtefatos opcionais (paginas extras):")
    for s in optional_status:
        mark = "OK" if s.present else "ausente"
        size = _fmt_size(s.size_bytes) if s.present else "-"
        print(f"  [{mark}] {s.rel_path} ({size}) — {s.label}")

    total = sum(s.size_bytes for s in required_status + optional_status if s.present)
    print(f"\nTamanho total presente: {_fmt_size(total)}")

    if missing_required:
        print("\nERRO: faltam artefatos obrigatorios para deploy minimo.", file=sys.stderr)
        return 1

    if args.strict and missing_optional:
        print("\nERRO (--strict): faltam artefatos opcionais.", file=sys.stderr)
        return 1

    if missing_optional and not args.strict:
        print("\nAviso: deploy minimo possivel; algumas paginas podem devolver 503.")

    print("\nPronto para rsync/scp — ver docs/DEPLOY_ARTEFATOS.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
