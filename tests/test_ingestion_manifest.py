"""Testes do manifesto determinstico da ingesto."""

import importlib
import json
from pathlib import Path

import pytest

manifest = importlib.import_module("data-pipeline.ingestion_manifest")


class _RemoteFile:
    def __init__(self, path: str):
        self.path = path


class _OpaqueRemoteFile:
    pass


def test_source_identity_eh_estavel_e_nao_depende_do_escopo():
    first = _RemoteFile("ftp://example/DOBA2024.DBC")
    second = _RemoteFile("ftp://example/DOBA2024.DBC")
    assert manifest.source_identity("SIM", "BA", 2024, first) == manifest.source_identity(
        "SIM", "SP", 2020, second
    )


def test_source_sem_path_falha_fechado():
    with pytest.raises(manifest.SourceReferenceError):
        manifest.source_identity("SIM", "BA", 2024, _OpaqueRemoteFile())


def test_deterministic_part_name_muda_quando_fonte_muda():
    name_a = manifest.deterministic_part_name(
        "SIM", "BA", 2024, _RemoteFile("ftp://example/DOBA2024.DBC")
    )
    name_b = manifest.deterministic_part_name(
        "SIM", "BA", 2024, _RemoteFile("ftp://example/DOBA2024_v2.DBC")
    )
    assert name_a != name_b
    assert name_a.startswith("sim_BA_2024_DOBA2024.DBC_")


def test_manifest_register_e_reexecucao_sao_idempotentes(tmp_path: Path):
    store = manifest.ManifestStore(tmp_path / "manifest.json")
    entry = {
        "source_identity": "a" * 64,
        "source_reference": "DOBA2024.DBC",
        "dataset": "SIM",
        "uf": "BA",
        "year": 2024,
        "target_path": "sim_BA_2024.parquet",
        "fingerprint": {"kind": "file", "size": 3, "sha256": "b" * 64},
        "status": "approved",
    }

    first = store.register(entry)
    second = store.register(entry)
    assert first["target_path"] == second["target_path"]
    assert len(store.entries) == 1
    assert json.loads((tmp_path / "manifest.json").read_text())["version"] == 1
    assert not list(tmp_path.glob("*.tmp"))
    assert not list(tmp_path.glob("*.lock"))


def test_manifest_completa_fingerprint_pendente_e_rejeita_drift(tmp_path: Path):
    store = manifest.ManifestStore(tmp_path / "manifest.json")
    base = {
        "source_identity": "a" * 64,
        "dataset": "SIM",
        "uf": "BA",
        "year": 2024,
        "target_path": "sim_BA_2024.parquet",
        "status": "pending",
    }
    store.register(base)
    approved = store.register(
        {
            **base,
            "status": "approved",
            "fingerprint": {"kind": "file", "size": 3, "sha256": "b" * 64},
        }
    )
    assert approved["status"] == "approved"

    with pytest.raises(manifest.ManifestConflictError):
        store.register(
            {
                **base,
                "status": "approved",
                "fingerprint": {"kind": "file", "size": 4, "sha256": "c" * 64},
            }
        )


def test_fingerprint_de_diretorio_e_deterministico(tmp_path: Path):
    root = tmp_path / "parquet"
    root.mkdir()
    (root / "b.bin").write_bytes(b"b")
    (root / "a.bin").write_bytes(b"a")
    first = manifest.file_fingerprint(root)
    second = manifest.file_fingerprint(root)
    assert first == second
    assert first["kind"] == "directory"
    assert first["size"] == 2
