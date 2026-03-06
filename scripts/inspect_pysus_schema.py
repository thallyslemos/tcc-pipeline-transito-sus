"""Inspeciona o schema dos arquivos Parquet baixados pelo PySUS.

Uso:
    uv run python scripts/inspect_pysus_schema.py

Lê todos os .parquet em ~/pysus/ e imprime colunas + tipos.
"""

from pathlib import Path

import duckdb


def inspect_parquet(path: Path) -> None:
    """Imprime schema de um arquivo Parquet."""
    con = duckdb.connect(":memory:")
    try:
        schema = con.sql(f"DESCRIBE SELECT * FROM read_parquet('{path}')").fetchall()
        sample = con.sql(f"SELECT * FROM read_parquet('{path}') LIMIT 3").fetchdf()
    finally:
        con.close()

    print(f"\n{'='*80}")
    print(f"  {path.name}")
    print(f"{'='*80}")

    con2 = duckdb.connect(":memory:")
    count = con2.sql(f"SELECT COUNT(*) FROM read_parquet('{path}')").fetchone()[0]
    con2.close()
    print(f"  Registros: {count:,}")
    print(f"\n  {'Coluna':<25} {'Tipo':<15} {'Exemplo (linha 1)'}")
    print(f"  {'-'*25} {'-'*15} {'-'*40}")
    for col_name, col_type, *_ in schema:
        val = sample[col_name].iloc[0] if len(sample) > 0 and col_name in sample.columns else "—"
        print(f"  {col_name:<25} {col_type:<15} {val}")


def main() -> None:
    pysus_dir = Path.home() / "pysus"
    if not pysus_dir.exists():
        print(f"Diretório {pysus_dir} não encontrado.")
        return

    parquets = sorted(pysus_dir.glob("*.parquet"))
    if not parquets:
        dirs = sorted(pysus_dir.glob("*.parquet/"))
        for d in dirs:
            inner = list(d.glob("*.parquet"))
            if inner:
                parquets.append(inner[0])
            else:
                parquets.append(d)

    if not parquets:
        print(f"Nenhum .parquet encontrado em {pysus_dir}")
        return

    sims = [p for p in parquets if p.name.startswith("DO")]
    sias = [p for p in parquets if p.name.startswith("PA")]

    if sims:
        print("\n" + "=" * 80)
        print("  SIM (Sistema de Informações sobre Mortalidade)")
        print("=" * 80)
        inspect_parquet(sims[0])

    if sias:
        print("\n" + "=" * 80)
        print("  SIA (Sistema de Informações Ambulatoriais)")
        print("=" * 80)
        inspect_parquet(sias[0])

    if not sims and not sias:
        print("Inspecionando primeiro arquivo encontrado:")
        inspect_parquet(parquets[0])


if __name__ == "__main__":
    main()
