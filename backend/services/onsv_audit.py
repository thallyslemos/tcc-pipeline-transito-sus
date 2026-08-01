"""Reconciliação metodológica local com a publicação ONSV DATASUS 2024.

O serviço trabalha somente com agregados derivados dos Parquets Bronze locais.
Arquivos com o mesmo conteúdo dentro da mesma UF/ano são contados uma única
vez para reconstruir o universo usado pela publicação do ONSV. Nenhum registro
individual, caminho absoluto ou campo potencialmente sensível é exposto pela
API.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from threading import Lock
from typing import Any

import duckdb

YEARS = tuple(range(2010, 2025))
CID_PREFIXES = tuple(f"V{index}" for index in range(9))
_SOURCE_RE = re.compile(r"^sim_(?P<uf>[A-Z]{2})_(?P<year>\d{4})_(?P<part>\d+)\.parquet$")

ONSV_SOURCE = {
    "name": "ONSV — Análise DATASUS 2024",
    "publication_url": "https://www.onsv.org.br/estudos/analise-datasus-2024",
    "repository_url": "https://github.com/ONSV/analise-datasus-2024",
    "methodology_file_url": (
        "https://raw.githubusercontent.com/ONSV/analise-datasus-2024/main/datasus2024.qmd"
    ),
    "release_date": "2026-01-14",
    "data_snapshot": "Base consolidada SIM 2024 disponibilizada em dezembro de 2025",
}

ONSV_ANCHORS = {2023: 34_881, 2024: 37_150}


@dataclass(frozen=True)
class _SourceManifest:
    """Inventário local sem expor nomes de arquivo na resposta HTTP."""

    observed: tuple[Path, ...]
    canonical: tuple[Path, ...]
    duplicate_files: int
    ignored_files: int
    fingerprint: str


_CACHE_LOCK = Lock()
_REPORT_CACHE: dict[str, tuple[tuple[tuple[str, int, int], ...], dict[str, Any]]] = {}


def _filesystem_signature(root: Path) -> tuple[tuple[str, int, int], ...]:
    """Retorna assinatura barata para invalidar o relatório quando Bronze muda."""

    items: list[tuple[str, int, int]] = []
    for path in sorted(root.glob("sim_*.parquet")):
        stat = path.stat()
        items.append((path.name, stat.st_size, stat.st_mtime_ns))
    return tuple(items)


def _sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _build_manifest(root: Path) -> _SourceManifest:
    if not root.exists():
        raise FileNotFoundError(f"Diretório Bronze não encontrado: {root}")

    observed: list[Path] = []
    ignored_files = 0
    canonical_by_key: dict[tuple[str, int, str], Path] = {}
    fingerprint = sha256()

    for path in sorted(root.glob("sim_*.parquet")):
        match = _SOURCE_RE.fullmatch(path.name)
        if match is None:
            ignored_files += 1
            continue

        uf = match.group("uf")
        year = int(match.group("year"))
        digest = _sha256_file(path)
        observed.append(path)
        fingerprint.update(f"{path.name}\0{digest}\n".encode())
        canonical_by_key.setdefault((uf, year, digest), path)

    canonical = tuple(sorted(canonical_by_key.values()))
    return _SourceManifest(
        observed=tuple(observed),
        canonical=canonical,
        duplicate_files=len(observed) - len(canonical),
        ignored_files=ignored_files,
        fingerprint=fingerprint.hexdigest(),
    )


def _sql_path_list(paths: tuple[Path, ...]) -> str:
    if not paths:
        raise ValueError("Nenhum Parquet SIM disponível para reconciliação")
    values = []
    for path in paths:
        escaped = path.resolve().as_posix().replace("'", "''")
        values.append(f"'{escaped}'")
    return "[" + ", ".join(values) + "]"


def _annual_counts(
    con: duckdb.DuckDBPyConnection,
    paths: tuple[Path, ...],
) -> dict[int, dict[str, int]]:
    """Conta o mesmo recorte do ONSV, com e sem arquivos redundantes."""

    source = f"read_parquet({_sql_path_list(paths)}, union_by_name=true)"
    year_expr = "CAST(EXTRACT(YEAR FROM TRY_STRPTIME(TRIM(DTOBITO), '%d%m%Y')) AS INTEGER)"
    cid_clause = ", ".join(f"'{prefix}'" for prefix in CID_PREFIXES)
    rows = con.sql(
        f"""
        SELECT
            {year_expr} AS ano,
            COUNT(*) AS ocorrencia_brasil,
            COUNT(*) FILTER (
                WHERE LEFT(TRIM(CODMUNOCOR), 2) = '29'
            ) AS ocorrencia_ba,
            COUNT(*) FILTER (
                WHERE LEFT(TRIM(CODMUNRES), 2) = '29'
            ) AS residencia_ba
        FROM {source}
        WHERE TRIM(TIPOBITO) = '2'
          AND LEFT(TRIM(CAUSABAS), 2) IN ({cid_clause})
          AND {year_expr} BETWEEN 2010 AND 2024
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchall()
    return {
        int(row[0]): {
            "ocorrencia_brasil": int(row[1]),
            "ocorrencia_ba": int(row[2]),
            "residencia_ba": int(row[3]),
        }
        for row in rows
        if row[0] is not None
    }


def _matching_tipobito_values(con: duckdb.DuckDBPyConnection, paths: tuple[Path, ...]) -> list[str]:
    source = f"read_parquet({_sql_path_list(paths)}, union_by_name=true)"
    cid_clause = ", ".join(f"'{prefix}'" for prefix in CID_PREFIXES)
    rows = con.sql(
        f"""
        SELECT DISTINCT TRIM(TIPOBITO) AS tipobito
        FROM {source}
        WHERE LEFT(TRIM(CAUSABAS), 2) IN ({cid_clause})
        ORDER BY 1
        """
    ).fetchall()
    return [str(row[0]) for row in rows if row[0] is not None]


def _methodologies() -> list[dict[str, Any]]:
    return [
        {
            "id": "onsv_2024",
            "label": "ONSV — publicação DATASUS 2024",
            "geography": "Município de ocorrência (CODMUNOCOR), Brasil",
            "time_field": "DTOBITO, transformado em ano_ocorrencia",
            "cid_rule": "substr(CAUSABAS, 1, 2) em V0-V8",
            "sex_rule": "SEXO=1 Masculino; SEXO=2 Feminino; demais NA",
            "age_rule": (
                "unidade 4 em anos; unidades 0-3 convertidas para 0; unidade 5 "
                "convertida para 100+; demais NA"
            ),
            "acquisition": (
                "microdatasus::fetch_datasus(year_start=1996, year_end=2024, "
                "information_system='SIM-DOEXT')"
            ),
            "source": ONSV_SOURCE,
        },
        {
            "id": "tcc_residencia",
            "label": "TCC — análise municipal principal",
            "geography": "Município de residência na Bahia",
            "time_field": "DTOBITO, ano do óbito",
            "cid_rule": "CID-10 V01-V89 validado explicitamente",
            "sex_rule": "SEXO=1 Masculino; SEXO=2 Feminino; 0/9 ignorado",
            "age_rule": "decodificação versionada do leiaute SIM, preservando raw",
            "acquisition": "Bronze local com manifesto e deduplicação por conteúdo",
            "source": {
                "name": "Contrato Silver v2 do projeto",
                "report_path": "docs/RELATORIO_VALIDACAO_SILVER_V2_SIM_BA_2010_2024.md",
            },
        },
    ]


def _build_report(root: Path, signature: tuple[tuple[str, int, int], ...]) -> dict[str, Any]:
    manifest = _build_manifest(root)
    con = duckdb.connect(":memory:")
    try:
        observed = _annual_counts(con, manifest.observed)
        canonical = _annual_counts(con, manifest.canonical)
        tipobito_values = _matching_tipobito_values(con, manifest.canonical)
    finally:
        con.close()

    annual: list[dict[str, Any]] = []
    for year in YEARS:
        with_copies = observed.get(year, {})
        deduplicated = canonical.get(year, {})
        published = ONSV_ANCHORS.get(year)
        local_total = deduplicated.get("ocorrencia_brasil", 0)
        item: dict[str, Any] = {
            "ano": year,
            "ocorrencia_brasil_deduplicada": local_total,
            "ocorrencia_brasil_com_copias": with_copies.get("ocorrencia_brasil", 0),
            "excesso_por_copias": (with_copies.get("ocorrencia_brasil", 0) - local_total),
            "ocorrencia_ba_deduplicada": deduplicated.get("ocorrencia_ba", 0),
            "residencia_ba_deduplicada": deduplicated.get("residencia_ba", 0),
            "onsv_publicado": published,
        }
        if published is not None:
            item["diferenca_onsv"] = local_total - published
            item["status_reconciliacao"] = (
                "reproduzido_localmente" if local_total == published else "divergente"
            )
        annual.append(item)

    anchor_comparisons = [
        {
            "ano": year,
            "onsv_publicado": ONSV_ANCHORS[year],
            "local_deduplicado": canonical.get(year, {}).get("ocorrencia_brasil", 0),
            "diferenca": canonical.get(year, {}).get("ocorrencia_brasil", 0) - ONSV_ANCHORS[year],
            "status": (
                "reproduzido_localmente"
                if canonical.get(year, {}).get("ocorrencia_brasil", 0) == ONSV_ANCHORS[year]
                else "divergente"
            ),
            "escopo": "ocorrencia_brasil",
        }
        for year in sorted(ONSV_ANCHORS)
    ]

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "scope": {
            "years": [YEARS[0], YEARS[-1]],
            "cid_prefixes": list(CID_PREFIXES),
            "tipobito_values_matching_cid": tipobito_values,
            "main_scientific_scope": "residencia_ba",
        },
        "source": {
            "kind": "bronze_local_deduplicated",
            "relative_root": "data/bronze/sim_parts",
            "files_observed": len(manifest.observed),
            "files_canonical": len(manifest.canonical),
            "duplicate_files_removed": manifest.duplicate_files,
            "ignored_files": manifest.ignored_files,
            "fingerprint": manifest.fingerprint,
            "filesystem_signature_entries": len(signature),
        },
        "anchors": anchor_comparisons,
        "annual": annual,
        "methodologies": _methodologies(),
        "interpretation": [
            (
                "A publicação ONSV é por ocorrência no Brasil; não deve ser "
                "comparada diretamente com a série principal por residência na Bahia."
            ),
            (
                "O prefixo V0-V8 usado no código ONSV corresponde às categorias "
                "V01-V89, mas não é uma validação explícita de cada código."
            ),
            (
                "A reprodução exata dos totais de 2023 e 2024 depende de "
                "deduplicar cópias idênticas do Bronze."
            ),
            (
                "A série principal do TCC deve continuar usando residência e "
                "população residente; ocorrência é uma dimensão secundária."
            ),
        ],
    }


def build_onsv_audit_report(bronze_dir: Path) -> dict[str, Any]:
    """Gera ou recupera um relatório auditável sem expor microdados."""

    root = bronze_dir.resolve()
    signature = _filesystem_signature(root)
    cache_key = root.as_posix()
    with _CACHE_LOCK:
        cached = _REPORT_CACHE.get(cache_key)
        if cached and cached[0] == signature:
            return cached[1]

    report = _build_report(root, signature)
    with _CACHE_LOCK:
        _REPORT_CACHE[cache_key] = (signature, report)
    return report
