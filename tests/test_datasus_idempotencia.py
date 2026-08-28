"""Testes do caminho de materializacao Bronze deterministico."""

import importlib
from pathlib import Path

import duckdb
import pytest

datasus = importlib.import_module("data-pipeline.datasus")
manifest_module = importlib.import_module("data-pipeline.ingestion_manifest")


class _RemoteFile:
    def __init__(self, path: str):
        self.path = path


class _LocalWrapper:
    def __init__(self, path: Path):
        self.path = path

    def __str__(self) -> str:
        return self.path.name


def _sample_parquet(path: Path) -> None:
    con = duckdb.connect(":memory:")
    try:
        con.sql(
            f"COPY (SELECT 'V01' AS CAUSABAS, '01012024' AS DTOBITO) TO '{path}' (FORMAT PARQUET)"
        )
    finally:
        con.close()


def test_resolve_pysus_prioriza_path_do_wrapper(tmp_path: Path):
    source = tmp_path / "cached.parquet"
    _sample_parquet(source)
    wrapper = _LocalWrapper(source)
    assert datasus._resolve_pysus_parquet(wrapper) == str(source)


def test_materializacao_reexecutada_reutiliza_manifesto(tmp_path: Path):
    source_path = tmp_path / "cached.parquet"
    _sample_parquet(source_path)
    remote = _RemoteFile("ftp://ftp.datasus.gov.br/SIM/CID10/DOBA2024.DBC")
    parts_dir = tmp_path / "parts"
    parts_dir.mkdir()
    store = manifest_module.ManifestStore(parts_dir / "sim_manifest.json")
    calls = {"download": 0}

    def download(_source):
        calls["download"] += 1
        return _LocalWrapper(source_path)

    first = datasus._materialize_remote_file(
        dataset="SIM",
        group="CID10",
        uf="BA",
        year=2024,
        source=remote,
        download=download,
        parts_dir=parts_dir,
        manifest=store,
    )
    second = datasus._materialize_remote_file(
        dataset="SIM",
        group="CID10",
        uf="BA",
        year=2024,
        source=remote,
        download=download,
        parts_dir=parts_dir,
        manifest=store,
    )

    assert first == second == 1
    assert calls["download"] == 1
    assert len(store.entries) == 1
    assert store.entries[0]["status"] == "approved"
    assert list(parts_dir.glob("*.tmp*")) == []


def test_alvo_legado_existente_nao_e_reutilizado(tmp_path: Path):
    source_path = tmp_path / "cached.parquet"
    _sample_parquet(source_path)
    remote = _RemoteFile("ftp://ftp.datasus.gov.br/SIM/CID10/DOBA2024.DBC")
    parts_dir = tmp_path / "parts"
    parts_dir.mkdir()
    target = parts_dir / datasus.deterministic_part_name("SIM", "BA", 2024, remote, group="CID10")
    _sample_parquet(target)
    store = manifest_module.ManifestStore(parts_dir / "sim_manifest.json")

    with pytest.raises(FileExistsError):
        datasus._materialize_remote_file(
            dataset="SIM",
            group="CID10",
            uf="BA",
            year=2024,
            source=remote,
            download=lambda _source: _LocalWrapper(source_path),
            parts_dir=parts_dir,
            manifest=store,
        )


def test_falha_de_conversao_nao_deixa_parquet_final(tmp_path: Path):
    remote = _RemoteFile("ftp://ftp.datasus.gov.br/SIM/CID10/DOBA2024.DBC")
    parts_dir = tmp_path / "parts"
    parts_dir.mkdir()
    store = manifest_module.ManifestStore(parts_dir / "sim_manifest.json")

    with pytest.raises((FileNotFoundError, duckdb.Error)):
        datasus._materialize_remote_file(
            dataset="SIM",
            group="CID10",
            uf="BA",
            year=2024,
            source=remote,
            download=lambda _source: _LocalWrapper(tmp_path / "missing.parquet"),
            parts_dir=parts_dir,
            manifest=store,
        )

    assert list(parts_dir.glob("*.parquet")) == []
    assert list(parts_dir.glob("*.tmp*")) == []
    assert store.entries[0]["status"] == "pending"

