"""Auditoria reprodutível e somente leitura da camada Silver do SIM."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import duckdb

PART_RE = re.compile(r"sim_([A-Z]{2})_(\d{4})_(\d+)\.parquet$")


def parse_part_name(name: str) -> tuple[str, int, int] | None:
    """Extrai UF, ano e índice de um nome de partição Bronze SIM."""
    match = PART_RE.fullmatch(name)
    if match is None:
        return None
    return match.group(1), int(match.group(2)), int(match.group(3))


def sha256(path: Path) -> str:
    """Calcula SHA-256 em blocos, sem carregar o arquivo inteiro em memória."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rows(con: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, object]]:
    """Executa SQL e converte o resultado em registros nomeados."""
    result = con.execute(query)
    names = [column[0] for column in result.description]
    return [dict(zip(names, row, strict=True)) for row in result.fetchall()]


def audit(root: Path, hash_uf: str = "BA") -> dict[str, object]:
    """Executa verificações sem modificar Bronze, Silver ou dimensões."""
    silver_path = root / "data" / "silver" / "sim.parquet"
    bronze_dir = root / "data" / "bronze" / "sim_parts"
    ibge_path = root / "data" / "ibge_municipios.parquet"
    for required in (silver_path, bronze_dir, ibge_path):
        if not required.exists():
            raise FileNotFoundError(required)

    parts: list[dict[str, object]] = []
    for path in sorted(bronze_dir.glob("*.parquet")):
        parsed = parse_part_name(path.name)
        if parsed is None:
            continue
        uf, year, index = parsed
        parts.append(
            {
                "path": path,
                "uf": uf,
                "ano": year,
                "indice": index,
                "bytes": path.stat().st_size,
            }
        )

    counts = Counter((str(part["uf"]), int(part["ano"])) for part in parts)
    hashes: list[dict[str, object]] = []
    for part in parts:
        if part["uf"] != hash_uf:
            continue
        hashes.append(
            {
                "ano": part["ano"],
                "arquivo": Path(part["path"]).name,
                "sha256": sha256(Path(part["path"])),
            }
        )
    hash_groups = Counter((int(item["ano"]), str(item["sha256"])) for item in hashes)

    con = duckdb.connect(":memory:")
    silver = silver_path.as_posix()
    bronze = (bronze_dir / "*.parquet").as_posix()
    ibge = ibge_path.as_posix()

    report: dict[str, object] = {
        "fontes": {
            "silver": str(silver_path),
            "bronze": str(bronze_dir),
            "ibge": str(ibge_path),
            "particoes_bronze": len(parts),
        },
        "particoes_por_uf_ano": [
            {"uf": key[0], "ano": key[1], "arquivos": value}
            for key, value in sorted(counts.items())
        ],
        "hashes_repetidos": [
            {"uf": hash_uf, "ano": key[0], "sha256": key[1], "copias": value}
            for key, value in sorted(hash_groups.items())
            if value > 1
        ],
        "schema_silver": rows(
            con,
            f"DESCRIBE SELECT * FROM read_parquet('{silver}')",
        ),
        "resumo_silver": rows(
            con,
            f"""
            WITH base AS (
                SELECT * FROM read_parquet('{silver}')
            ),
            distintos AS (
                SELECT COUNT(*) AS n FROM (SELECT DISTINCT * FROM base)
            )
            SELECT
                COUNT(*) AS linhas,
                distintos.n AS linhas_distintas,
                COUNT(*) - distintos.n AS duplicatas_exatas,
                MIN(dt_obito) AS data_min,
                MAX(dt_obito) AS data_max,
                COUNT(DISTINCT YEAR(dt_obito)) AS anos,
                COUNT(DISTINCT uf) AS ufs_arquivo
            FROM base, distintos
            GROUP BY distintos.n
            """,
        ),
        "por_ano": rows(
            con,
            f"""
            WITH base AS (
                SELECT YEAR(dt_obito) AS ano, * FROM read_parquet('{silver}')
            ),
            totais AS (
                SELECT ano, COUNT(*) AS linhas FROM base GROUP BY ano
            ),
            distintos AS (
                SELECT ano, COUNT(*) AS linhas_distintas
                FROM (SELECT DISTINCT * FROM base)
                GROUP BY ano
            )
            SELECT
                t.ano,
                t.linhas,
                d.linhas_distintas,
                t.linhas - d.linhas_distintas AS duplicatas_exatas
            FROM totais t
            JOIN distintos d USING (ano)
            ORDER BY t.ano
            """,
        ),
        "dominios": rows(
            con,
            f"""
            SELECT
                COUNT_IF(NOT regexp_matches(causabas, '^V[0-9]{{2}}([0-9A-Z]{{0,2}})?$'))
                    AS cid_formato_invalido,
                COUNT_IF(cid_grupo < 'V01' OR cid_grupo > 'V89') AS cid_fora_v01_v89,
                COUNT_IF(dt_obito IS NULL) AS data_nula,
                COUNT_IF(dt_obito > CURRENT_DATE) AS data_futura,
                COUNT_IF(idade < 0 OR idade > 120) AS idade_impossivel,
                COUNT_IF(idade = 0) AS idade_zero,
                COUNT_IF(sexo NOT IN (1, 2, 9)) AS sexo_fora_dominio,
                COUNT_IF(sexo_desc = 'Feminino' AND sexo <> 2)
                    AS sexo_nao_feminino_rotulado_feminino,
                COUNT_IF(cod_mun_ocorrencia IS NULL OR cod_mun_ocorrencia = '')
                    AS municipio_ocorrencia_nulo,
                COUNT_IF(cod_mun_residencia IS NULL OR cod_mun_residencia = '')
                    AS municipio_residencia_nulo
            FROM read_parquet('{silver}')
            """,
        ),
        "geografia": rows(
            con,
            f"""
            WITH s AS (
                SELECT
                    *,
                    LEFT(cod_mun_ocorrencia, 2) AS uf_ocorrencia,
                    LEFT(cod_mun_residencia, 2) AS uf_residencia
                FROM read_parquet('{silver}')
            ),
            i AS (
                SELECT DISTINCT LEFT(CAST(cod_mun_ibge AS VARCHAR), 6) AS cod6
                FROM read_parquet('{ibge}')
            )
            SELECT
                COUNT_IF(uf_ocorrencia = '29') AS obitos_ocorrencia_bahia,
                COUNT_IF(uf_residencia = '29') AS obitos_residencia_bahia,
                COUNT_IF(
                    CASE uf
                        WHEN 'RO' THEN '11' WHEN 'AC' THEN '12' WHEN 'AM' THEN '13'
                        WHEN 'RR' THEN '14' WHEN 'PA' THEN '15' WHEN 'AP' THEN '16'
                        WHEN 'TO' THEN '17' WHEN 'MA' THEN '21' WHEN 'PI' THEN '22'
                        WHEN 'CE' THEN '23' WHEN 'RN' THEN '24' WHEN 'PB' THEN '25'
                        WHEN 'PE' THEN '26' WHEN 'AL' THEN '27' WHEN 'SE' THEN '28'
                        WHEN 'BA' THEN '29' WHEN 'MG' THEN '31' WHEN 'ES' THEN '32'
                        WHEN 'RJ' THEN '33' WHEN 'SP' THEN '35' WHEN 'PR' THEN '41'
                        WHEN 'SC' THEN '42' WHEN 'RS' THEN '43' WHEN 'MS' THEN '50'
                        WHEN 'MT' THEN '51' WHEN 'GO' THEN '52' WHEN 'DF' THEN '53'
                    END <> uf_ocorrencia
                ) AS uf_arquivo_diverge_ocorrencia,
                COUNT_IF(NOT EXISTS (
                    SELECT 1 FROM i WHERE i.cod6 = LEFT(s.cod_mun_ocorrencia, 6)
                )) AS ocorrencia_sem_join_ibge,
                COUNT_IF(NOT EXISTS (
                    SELECT 1 FROM i WHERE i.cod6 = LEFT(s.cod_mun_residencia, 6)
                )) AS residencia_sem_join_ibge
            FROM s
            """,
        ),
        "bronze_para_silver": rows(
            con,
            f"""
            WITH b AS (
                SELECT
                    COALESCE(
                        TRY_CAST(DTOBITO AS DATE),
                        TRY_STRPTIME(TRIM(CAST(DTOBITO AS VARCHAR)), '%d%m%Y')
                    ) AS dt,
                    LEFT(TRIM(CAST(CAUSABAS AS VARCHAR)), 3) AS cid3
                FROM read_parquet('{bronze}', union_by_name=true)
            )
            SELECT
                COUNT(*) AS bronze_total,
                COUNT_IF(cid3 BETWEEN 'V01' AND 'V89') AS bronze_v01_v89,
                COUNT_IF(cid3 BETWEEN 'V01' AND 'V89' AND dt IS NULL)
                    AS v01_v89_data_invalida,
                COUNT_IF(cid3 BETWEEN 'V01' AND 'V89' AND dt IS NOT NULL)
                    AS silver_esperada_pela_regra
            FROM b
            """,
        ),
    }
    con.close()
    return report


def main() -> None:
    """Interface de linha de comando."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Raiz do repositório.",
    )
    parser.add_argument(
        "--hash-uf",
        default="BA",
        help="UF cujas partições serão verificadas por SHA-256.",
    )
    args = parser.parse_args()
    print(
        json.dumps(
            audit(args.root.resolve(), args.hash_uf.upper()),
            ensure_ascii=False,
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
