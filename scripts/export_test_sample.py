"""Exporta amostra dos dados reais do bronze para testar o pipeline remotamente.

Uso (na sua máquina com dados reais):
    uv run python scripts/export_test_sample.py

Gera: data/test_sample/ com parquets pequenos (~1000 registros cada)
que podem ser enviados ao repositório ou compartilhados para teste.
"""

from pathlib import Path

import duckdb

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = PROJECT_ROOT / "data" / "bronze"
OUTPUT_DIR = PROJECT_ROOT / "data" / "test_sample"
SAMPLE_ROWS = 1000


def export_sample(source: Path, dest: Path, n: int = SAMPLE_ROWS) -> None:
    """Exporta N linhas de um parquet para outro."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")
    con.sql(f"""
        COPY (SELECT * FROM read_parquet('{source}') LIMIT {n})
        TO '{dest}' (FORMAT PARQUET)
    """)
    count = con.sql(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    con.close()
    print(f"  {dest.name}: {count} registros")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Exportando amostras para {OUTPUT_DIR}/\n")

    sim_parts = BRONZE_DIR / "sim_parts"
    sia_parts = BRONZE_DIR / "sia_parts"

    if sim_parts.exists():
        first_sim = sorted(sim_parts.glob("*.parquet"))[:1]
        for f in first_sim:
            export_sample(f, OUTPUT_DIR / f"sample_sim_{f.stem}.parquet")

        con = duckdb.connect(":memory:")
        schema = con.sql(
            f"DESCRIBE SELECT * FROM read_parquet('{first_sim[0]}')"
        ).fetchall()
        con.close()
        print("\n  SIM schema:")
        for col_name, col_type, *_ in schema:
            print(f"    {col_name}: {col_type}")
    else:
        sim_file = BRONZE_DIR / "sim.parquet"
        if sim_file.exists():
            export_sample(sim_file, OUTPUT_DIR / "sample_sim.parquet")

    if sia_parts.exists():
        first_sia = sorted(sia_parts.glob("*.parquet"))[:1]
        for f in first_sia:
            export_sample(f, OUTPUT_DIR / f"sample_sia_{f.stem}.parquet")

        con = duckdb.connect(":memory:")
        schema = con.sql(
            f"DESCRIBE SELECT * FROM read_parquet('{first_sia[0]}')"
        ).fetchall()
        con.close()
        print("\n  SIA schema:")
        for col_name, col_type, *_ in schema:
            print(f"    {col_name}: {col_type}")
    else:
        sia_file = BRONZE_DIR / "sia.parquet"
        if sia_file.exists():
            export_sample(sia_file, OUTPUT_DIR / "sample_sia.parquet")

    print(f"\nPronto! Arquivos em {OUTPUT_DIR}/")
    print("Envie esses arquivos para o repositório ou compartilhe para teste remoto.")
    print("\nPara usar no pipeline de teste:")
    print("  cp data/test_sample/sample_sim_*.parquet data/bronze/sim_parts/")
    print("  cp data/test_sample/sample_sia_*.parquet data/bronze/sia_parts/")


if __name__ == "__main__":
    main()
