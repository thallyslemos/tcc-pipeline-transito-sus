"""Extracao DATASUS via PySUS com materializacao Bronze auditavel."""

from __future__ import annotations

import gc
import hashlib
import json
import os
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

from .config import settings
from .ingestion_manifest import (
    ManifestStore,
    deterministic_part_name,
    file_fingerprint,
    source_identity,
    source_reference,
)
from .logging import get_logger

logger = get_logger(__name__)

UFS_BRASIL = [
    "AC",
    "AL",
    "AM",
    "AP",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MG",
    "MS",
    "MT",
    "PA",
    "PB",
    "PE",
    "PI",
    "PR",
    "RJ",
    "RN",
    "RO",
    "RR",
    "RS",
    "SC",
    "SE",
    "SP",
    "TO",
]

UFS_POR_ESTADO = {
    "SP": ["SP"],
    "MG": ["MG"],
    "BA": ["BA"],
    "RJ": ["RJ"],
    "RS": ["RS"],
    "PR": ["PR"],
    "PE": ["PE"],
    "CE": ["CE"],
    "PA": ["PA"],
    "MA": ["MA"],
    "GO": ["GO"],
    "SC": ["SC"],
}


def baixar_sim(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
) -> pd.DataFrame:
    """Baixa dados SIM e devolve um DataFrame (modo legado em memoria)."""
    from pysus.online_data.SIM import SIM

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    logger.info("sim_download_iniciando", ufs=ufs, anos=anos)
    sim = SIM().load()
    all_dfs = []
    for uf in ufs:
        for ano in anos:
            try:
                files = sim.get_files("CID10", uf=uf, year=ano)
                if not files:
                    logger.warning("sim_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files:
                    parquet = sim.download(f)
                    df = parquet.to_dataframe()
                    df["UF"] = uf
                    all_dfs.append(df)
                    logger.info("sim_arquivo_baixado", uf=uf, ano=ano, registros=len(df))
            except Exception as exc:
                logger.error("sim_erro_download", uf=uf, ano=ano, erro=str(exc))
    if not all_dfs:
        raise ConnectionError("Nenhum dado SIM baixado. Verifique o FTP DATASUS.")
    result = pd.concat(all_dfs, ignore_index=True)
    logger.info("sim_download_concluido", total=len(result))
    return result


def baixar_sia(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    meses: list[int] | None = None,
) -> pd.DataFrame:
    """Baixa dados SIA/PA e devolve um DataFrame (modo legado em memoria)."""
    from pysus.online_data.SIA import SIA

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    meses = meses or list(range(1, 13))
    logger.info("sia_download_iniciando", ufs=ufs, anos=anos)
    sia = SIA().load()
    all_dfs = []
    for uf in ufs:
        for ano in anos:
            try:
                files = sia.get_files("PA", uf=uf, year=ano, month=meses)
                if not files:
                    logger.warning("sia_sem_arquivos", uf=uf, ano=ano)
                    continue
                for f in files if isinstance(files, list) else [files]:
                    parquet = sia.download(f)
                    df = parquet.to_dataframe()
                    df["UF"] = uf
                    all_dfs.append(df)
                    logger.info("sia_arquivo_baixado", uf=uf, ano=ano, registros=len(df))
            except Exception as exc:
                logger.error("sia_erro_download", uf=uf, ano=ano, erro=str(exc))
    if not all_dfs:
        raise ConnectionError("Nenhum dado SIA baixado. Verifique o FTP DATASUS.")
    result = pd.concat(all_dfs, ignore_index=True)
    logger.info("sia_download_concluido", total=len(result))
    return result


def _liberar_memoria() -> None:
    gc.collect()


def _duckdb_literal(value: str | Path) -> str:
    return str(value).replace("'", "''")


def _parquet_count(path: Path) -> int:
    con = duckdb.connect(":memory:")
    try:
        return int(
            con.sql(f"SELECT COUNT(*) FROM read_parquet('{_duckdb_literal(path)}')").fetchone()[0]
        )
    finally:
        con.close()


def _parquet_schema(path: Path) -> list[dict[str, str]]:
    con = duckdb.connect(":memory:")
    try:
        rows = con.sql(f"DESCRIBE SELECT * FROM read_parquet('{_duckdb_literal(path)}')").fetchall()
    finally:
        con.close()
    return [{"name": str(row[0]), "type": str(row[1])} for row in rows]


def _schema_fingerprint(schema: list[dict[str, str]]) -> str:
    payload = json.dumps(schema, ensure_ascii=True, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _pysus_to_bronze_duckdb(pysus_path: str, bronze_path: Path, uf: str) -> int:
    """Converte para Parquet em arquivo temporario e promove atomicamente."""
    bronze_path = Path(bronze_path)
    bronze_path.parent.mkdir(parents=True, exist_ok=True)
    if bronze_path.exists():
        raise FileExistsError(f"Destino Bronze ja existe sem nova aprovacao: {bronze_path}")

    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{bronze_path.name}.", suffix=".tmp.parquet", dir=bronze_path.parent
    )
    os.close(fd)
    temporary = Path(temporary_name)
    temporary.unlink()
    con = duckdb.connect(":memory:")
    try:
        source = _duckdb_literal(pysus_path)
        uf_value = _duckdb_literal(uf)
        con.sql(
            f"""
            COPY (
                SELECT *, '{uf_value}' AS UF
                FROM read_parquet('{source}')
            ) TO '{_duckdb_literal(temporary)}' (FORMAT PARQUET)
            """
        )
        count = int(
            con.sql(
                f"SELECT COUNT(*) FROM read_parquet('{_duckdb_literal(temporary)}')"
            ).fetchone()[0]
        )
        if count < 0 or not temporary.exists() or temporary.stat().st_size == 0:
            raise ValueError(f"Parquet Bronze vazio ou invalido: {temporary}")
        os.replace(temporary, bronze_path)
        return count
    finally:
        con.close()
        if temporary.exists():
            temporary.unlink()


def _resolve_pysus_parquet(pysus_data: Any) -> str:
    """Resolve Path de wrappers PySUS 1.x/2.x sem usar ``str`` prematuramente."""
    if isinstance(pysus_data, (list, tuple)):
        if len(pysus_data) != 1:
            raise ValueError("Download PySUS ambiguo: esperado um unico arquivo")
        return _resolve_pysus_parquet(pysus_data[0])
    candidate = getattr(pysus_data, "path", None)
    if candidate is None:
        candidate = getattr(pysus_data, "local_path", None)
    if candidate is None:
        candidate = pysus_data
    try:
        path = Path(os.fspath(candidate))
    except TypeError as exc:
        raise TypeError(f"Objeto PySUS sem caminho local: {type(pysus_data)!r}") from exc
    if path.is_dir():
        return str(path / "*.parquet")
    return str(path)


def _remote_files(files: Any) -> list[Any]:
    if files is None:
        return []
    result = list(files) if isinstance(files, (list, tuple, set)) else [files]
    return sorted(result, key=source_reference)


def _materialize_remote_file(
    *,
    dataset: str,
    group: str,
    uf: str,
    year: int,
    source: Any,
    download: Callable[[Any], Any],
    parts_dir: Path,
    manifest: ManifestStore,
) -> int:
    """Materializa uma origem e registra somente apos validar o Parquet."""
    reference = source_reference(source)
    identity = source_identity(dataset, uf, year, source, group=group)
    existing = manifest.get(identity)
    target_name = (
        str(existing["target_path"])
        if existing
        else deterministic_part_name(dataset, uf, year, source, group=group)
    )
    target = parts_dir / target_name
    base = {
        "source_identity": identity,
        "source_reference": reference,
        "dataset": dataset,
        "group": group,
        "uf": uf,
        "year": year,
        "target_path": target_name,
    }

    if existing and target.exists():
        count = _parquet_count(target)
        fingerprint = file_fingerprint(target)
        manifest.register(
            {
                **base,
                "status": "approved",
                "fingerprint": fingerprint,
                "row_count": count,
                "schema": _parquet_schema(target),
            }
        )
        return count
    if not existing and target.exists():
        raise FileExistsError(f"Alvo deterministico ja existe sem manifesto: {target}")

    manifest.register({**base, "status": "pending"})
    pysus_data = download(source)
    pysus_path = _resolve_pysus_parquet(pysus_data)
    count = _pysus_to_bronze_duckdb(pysus_path, target, uf)
    fingerprint = file_fingerprint(target)
    manifest.register(
        {
            **base,
            "status": "approved",
            "fingerprint": fingerprint,
            "row_count": count,
            "schema": _parquet_schema(target),
            "schema_fingerprint": _schema_fingerprint(_parquet_schema(target)),
        }
    )
    _liberar_memoria()
    return count


def _streaming_download(
    *,
    dataset: str,
    group: str,
    ufs: list[str],
    anos: list[int],
    parts_dir_name: str,
    get_files: Callable[[str, int], Any],
    download: Callable[[Any], Any],
    allow_partial: bool,
) -> Path:
    parts_dir = settings.resolve(settings.bronze_dir) / parts_dir_name
    parts_dir.mkdir(parents=True, exist_ok=True)
    manifest = ManifestStore(parts_dir / f"{dataset.lower()}_manifest.json")
    total = 0
    errors: list[str] = []
    for uf in ufs:
        for year in anos:
            try:
                files = _remote_files(get_files(uf, year))
                if not files:
                    logger.warning(f"{dataset.lower()}_sem_arquivos", uf=uf, ano=year)
                    continue
                for source in files:
                    total += _materialize_remote_file(
                        dataset=dataset,
                        group=group,
                        uf=uf,
                        year=year,
                        source=source,
                        download=download,
                        parts_dir=parts_dir,
                        manifest=manifest,
                    )
            except Exception as exc:
                errors.append(f"{uf}/{year}: {exc}")
                logger.error(f"{dataset.lower()}_erro_download", uf=uf, ano=year, erro=str(exc))
    if total == 0:
        raise ConnectionError(f"Nenhum dado {dataset} baixado. Verifique o FTP DATASUS.")
    if errors and not allow_partial:
        raise RuntimeError(
            f"Ingestao {dataset} incompleta; erros preservados no log: {'; '.join(errors)}"
        )
    logger.info(
        f"{dataset.lower()}_streaming_concluido",
        total=total,
        entradas_aprovadas=len(manifest.entries),
        erros=len(errors),
    )
    return parts_dir


def baixar_sim_streaming(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    *,
    allow_partial: bool = False,
) -> Path:
    """Baixa SIM em partes deterministicas com manifesto aprovado."""
    from pysus.online_data.SIM import SIM

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    sim = SIM().load()
    return _streaming_download(
        dataset="SIM",
        group="CID10",
        ufs=ufs,
        anos=anos,
        parts_dir_name="sim_parts",
        get_files=lambda uf, year: sim.get_files("CID10", uf=uf, year=year),
        download=sim.download,
        allow_partial=allow_partial,
    )


def baixar_sia_streaming(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    meses: list[int] | None = None,
    *,
    allow_partial: bool = False,
) -> Path:
    """Baixa SIA/PA em partes deterministicas com manifesto aprovado."""
    from pysus.online_data.SIA import SIA

    ufs = ufs or ["BA", "SP", "MG"]
    anos = anos or list(range(2019, 2024))
    meses = meses or list(range(1, 13))
    sia = SIA().load()

    def get_files(uf: str, year: int) -> Any:
        return sia.get_files("PA", uf=uf, year=year, month=meses)

    return _streaming_download(
        dataset="SIA",
        group="PA",
        ufs=ufs,
        anos=anos,
        parts_dir_name="sia_parts",
        get_files=get_files,
        download=sia.download,
        allow_partial=allow_partial,
    )
