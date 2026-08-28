"""Executa o protocolo SQL inicial do TCC II com DuckDB em modo reprodutível."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb

QUERY_MARKER = re.compile(r"^-- query: ([a-z0-9_]+)\s*$", re.MULTILINE)
SILVER_RELATIVE_PATH = Path("silver/sim_v2_nacional_2010_2024_contract_v2.parquet")


def parse_queries(sql_text: str) -> list[tuple[str, str]]:
    """Separa blocos SQL nomeados por marcadores ``-- query: nome``."""
    matches = list(QUERY_MARKER.finditer(sql_text))
    queries: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(sql_text)
        query = sql_text[start:end].strip()
        if query:
            queries.append((match.group(1), query))
    return queries


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    """Calcula SHA-256 por streaming, sem carregar o arquivo inteiro em memória."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def serialize(value: Any) -> Any:
    """Converte valores DuckDB para JSON sem perder a representação textual."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def write_csv(path: Path, columns: list[str], rows: list[tuple[Any, ...]]) -> None:
    """Grava o resultado tabular em UTF-8 com cabeçalho."""
    with path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target, lineterminator="\n")
        writer.writerow(columns)
        writer.writerows(rows)


def execute_protocol(
    data_root: Path,
    sql_path: Path,
    output_dir: Path,
    population_path: Path | None = None,
) -> dict[str, Any]:
    """Executa todas as consultas e retorna o manifesto metodológico."""
    data_root = data_root.resolve()
    population_path = (
        (data_root / "ibge_populacao.parquet")
        if population_path is None
        else population_path.resolve()
    )
    sql_text = sql_path.read_text(encoding="utf-8")
    queries = parse_queries(sql_text)
    output_dir.mkdir(parents=True, exist_ok=True)

    connection = duckdb.connect(":memory:")
    connection.execute("SET threads = 4")
    connection.execute("SET preserve_insertion_order = false")
    silver_path = data_root / SILVER_RELATIVE_PATH
    connection.execute(
        """
        CREATE TEMP TABLE sim_analitico AS
        SELECT *
        FROM read_parquet(?)
        WHERE is_v01_v89
          AND qa_status = 'ok'
          AND tipobito_raw = '2'
        """,
        [str(silver_path)],
    )

    manifest: dict[str, Any] = {
        "executado_em_utc": datetime.now(UTC).isoformat(),
        "duckdb_version": duckdb.__version__,
        "data_root": str(data_root),
        "population_path": str(population_path),
        "sql_file": str(sql_path.resolve()),
        "sql_sha256": hashlib.sha256(sql_text.encode("utf-8")).hexdigest(),
        "filtro_cientifico": "is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'",
        "arquivos": {},
        "consultas": {},
    }
    manifest["arquivos_externos"] = {
        "populacao": {
            "caminho": str(population_path),
            "existe": population_path.exists(),
            "bytes": population_path.stat().st_size if population_path.exists() else None,
            "sha256": sha256_file(population_path) if population_path.exists() else None,
        }
    }

    input_files = (
        SILVER_RELATIVE_PATH,
        Path("silver/sim_v2_nacional_2010_2024.manifest.json"),
        Path("gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet"),
        Path("gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet"),
        Path("ibge_municipios.parquet"),
        Path("ibge_populacao.parquet"),
        Path("ibge_malhas_municipios.geojson"),
    )
    for relative_path in input_files:
        path = data_root / relative_path
        manifest["arquivos"][str(relative_path)] = {
            "existe": path.exists(),
            "bytes": path.stat().st_size if path.exists() else None,
            "sha256": sha256_file(path) if path.exists() else None,
        }

    for name, query_template in queries:
        query = query_template.replace("{{DATA_ROOT}}", data_root.as_posix()).replace(
            "{{POPULATION_PATH}}", population_path.as_posix()
        )
        result = connection.execute(query)
        columns = [description[0] for description in result.description]
        rows = result.fetchall()
        result_path = output_dir / f"{name}.csv"
        write_csv(result_path, columns, rows)
        manifest["consultas"][name] = {
            "linhas": len(rows),
            "colunas": columns,
            "arquivo": f"{name}.csv",
            "sql_sha256": hashlib.sha256(query.encode("utf-8")).hexdigest(),
            "amostra": [
                {column: serialize(value) for column, value in zip(columns, row, strict=True)}
                for row in rows[:20]
            ],
        }
        # Todo resultado nomeado fica disponível para consultas posteriores.
        # Isso elimina uma lista manual de dependências entre blocos SQL e
        # permite compor protocolos de fluxo, frota e anomalias sem duplicar
        # leituras da Silver.
        escaped_result_path = result_path.resolve().as_posix().replace("'", "''")
        connection.execute(
            f"CREATE OR REPLACE TEMP VIEW resultado_{name} "
            f"AS SELECT * FROM read_csv_auto('{escaped_result_path}')"
        )

    manifest_path = output_dir / "manifesto_execucao.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    """Cria a interface de linha de comando."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--sql", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--population-path", type=Path)
    return parser


def main() -> None:
    """Executa o protocolo e imprime um resumo JSON."""
    args = build_parser().parse_args()
    manifest = execute_protocol(
        args.data_root,
        args.sql,
        args.output_dir,
        population_path=args.population_path,
    )
    print(
        json.dumps(
            {
                "output_dir": str(args.output_dir.resolve()),
                "consultas": len(manifest["consultas"]),
                "executado_em_utc": manifest["executado_em_utc"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
