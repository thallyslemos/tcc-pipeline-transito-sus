"""Exporta amostra FILTRADA dos dados reais bronze para teste do pipeline.

Filtra:
- SIM: apenas registros com CAUSABAS V01-V89 (acidentes de trânsito)
- SIA: apenas registros com PA_CIDPRI V01-V89
- Ambos: apenas municípios com mais registros

Uso (na sua máquina com dados reais):
    uv run python scripts/export_test_sample.py

Gera: data/test_sample/ com parquets filtrados e úteis para teste.
"""

from pathlib import Path

import duckdb

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = PROJECT_ROOT / "data" / "bronze"
OUTPUT_DIR = PROJECT_ROOT / "data" / "test_sample"


def export_sim(source_dir: Path, dest: Path, max_rows: int = 5000) -> None:
    """Exporta SIM filtrado por CID V01-V89."""
    source = f"{source_dir}/*.parquet" if source_dir.is_dir() else str(source_dir)
    dest.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT * FROM read_parquet('{source}')
            WHERE LEFT(TRIM(CAST(CAUSABAS AS VARCHAR)), 3) BETWEEN 'V01' AND 'V89'
            LIMIT {max_rows}
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    count = con.sql(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    con.close()
    print(f"  SIM: {count} registros (filtrado V01-V89)")


def export_sia(source_dir: Path, dest: Path, max_rows: int = 5000) -> None:
    """Exporta SIA filtrado por CID V01-V89."""
    source = f"{source_dir}/*.parquet" if source_dir.is_dir() else str(source_dir)
    dest.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (
            SELECT * FROM read_parquet('{source}')
            WHERE LEFT(TRIM(CAST(PA_CIDPRI AS VARCHAR)), 3) BETWEEN 'V01' AND 'V89'
            LIMIT {max_rows}
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    count = con.sql(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    con.close()
    print(f"  SIA: {count} registros (filtrado V01-V89)")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Exportando amostras filtradas para {OUTPUT_DIR}/\n")

    sim_parts = BRONZE_DIR / "sim_parts"
    sia_parts = BRONZE_DIR / "sia_parts"
    sim_file = BRONZE_DIR / "sim.parquet"
    sia_file = BRONZE_DIR / "sia.parquet"

    sim_source = sim_parts if sim_parts.exists() else sim_file
    sia_source = sia_parts if sia_parts.exists() else sia_file

    if sim_source.exists():
        export_sim(sim_source, OUTPUT_DIR / "sample_sim.parquet")
    else:
        print("  SIM: nenhum dado bronze encontrado")

    if sia_source.exists():
        export_sia(sia_source, OUTPUT_DIR / "sample_sia.parquet")
    else:
        print("  SIA: nenhum dado bronze encontrado")

    print("\nPronto! Envie data/test_sample/ ao repositório:")
    print("  git add data/test_sample/")
    print("  git commit -m 'chore: atualizar samples filtrados'")
    print("  git push")


if __name__ == "__main__":
    main()
