"""Identidade determinstica e manifesto atmico para ingestes do ETL."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import tempfile
import time
from collections.abc import Mapping
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

MANIFEST_VERSION = 1
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_SOURCE_KEYS = (
    "remote_path",
    "path",
    "url",
    "filename",
    "file_name",
    "name",
    "basename",
)
_STATUS_ORDER = {
    "pending": 0,
    "downloaded": 1,
    "validated": 2,
    "approved": 3,
    "stale": 4,
    "failed": 4,
}


class ManifestConflictError(ValueError):
    """Indica que uma identidade ou alvo j possui contedo incompatvel."""


class SourceReferenceError(ValueError):
    """Indica que a fonte no exps uma referncia remota estvel."""


def _scalar_text(value: Any) -> str | None:
    if value is None or callable(value):
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip()
    if isinstance(value, (str, int, float, Path)):
        return str(value).strip()
    return None


def _normalise_reference(value: str) -> str:
    """Normaliza separadores sem alterar caixa do caminho remoto."""
    return value.replace("\\", "/").strip()


def source_reference(source: Any) -> str:
    """Obtm o caminho/URL remoto estvel exposto pelo PySUS.

    No h fallback para ``repr``: sem ``path``/``url`` no  seguro afirmar
    que duas instncias representam a mesma fonte.
    """
    if isinstance(source, Mapping):
        values = ((key, source.get(key)) for key in _SOURCE_KEYS)
    else:
        values = ((key, getattr(source, key, None)) for key in _SOURCE_KEYS)
    for _key, raw_value in values:
        value = _scalar_text(raw_value)
        if value:
            return _normalise_reference(value)
    raise SourceReferenceError("Fonte PySUS sem path/url remoto estvel; ingesto interrompida")


def source_identity(
    dataset: str,
    uf: str | None,
    year: int | None,
    source: Any,
    *,
    client: str = "ftp",
    group: str | None = None,
) -> str:
    """Retorna o SHA-256 da origem, independente da ordem/escopo da consulta.

    ``uf`` e ``year`` permanecem na assinatura por compatibilidade e so
    metadados de partio, no componentes da identidade. O caminho remoto j
    deve conter a distino da fonte; incluir o escopo solicitado faria a mesma
    origem ganhar novos IDs quando a consulta fosse ampliada ou reordenada.
    """
    del uf, year
    payload = {
        "client": str(client).strip().lower(),
        "dataset": str(dataset).strip().upper(),
        "group": (str(group).strip().upper() if group else None),
        "source_reference": source_reference(source),
    }
    encoded = json.dumps(payload, ensure_ascii=True, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def deterministic_part_name(
    dataset: str,
    uf: str,
    year: int,
    source: Any,
    *,
    suffix: str = ".parquet",
    client: str = "ftp",
    group: str | None = None,
) -> str:
    """Gera nome legvel sem depender de ndice ou ordem de listagem."""
    reference = source_reference(source)
    stem = Path(reference).name or "source"
    stem = _SAFE_NAME_RE.sub("_", stem).strip("._-") or "source"
    stem = stem[:80]
    digest = source_identity(dataset, uf, year, source, client=client, group=group)[:16]
    ext = suffix if suffix.startswith(".") else f".{suffix}"
    dataset_name = str(dataset).strip().lower()
    uf_name = str(uf).strip().upper()
    return f"{dataset_name}_{uf_name}_{int(year)}_{stem}_{digest}{ext}"


def file_fingerprint(path: Path, *, chunk_size: int = 1024 * 1024) -> dict[str, Any]:
    """Calcula impresso digital de arquivo ou diretrio Parquet."""
    path = Path(path)
    digest = hashlib.sha256()
    total_size = 0
    if path.is_file():
        files = [(None, path)]
    elif path.is_dir():
        files = sorted(
            (item.relative_to(path).as_posix(), item) for item in path.rglob("*") if item.is_file()
        )
    else:
        raise FileNotFoundError(path)
    for relative, item in files:
        if relative is not None:
            digest.update(relative.encode("utf-8"))
            digest.update(b"\0")
        with item.open("rb") as stream:
            for chunk in iter(lambda: stream.read(chunk_size), b""):
                digest.update(chunk)
                total_size += len(chunk)
    return {
        "kind": "directory" if path.is_dir() else "file",
        "size": total_size,
        "sha256": digest.hexdigest(),
    }


def _atomic_write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        try:
            directory_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        except OSError:
            pass
    finally:
        if temporary.exists():
            temporary.unlink()


def _normalise_fingerprint(value: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    result = {key: value[key] for key in ("kind", "size", "sha256") if key in value}
    return result or None


class ManifestStore:
    """Leitor/escritor de manifesto com atualizao atmica e lock advisory."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.lock_path = self.path.with_name(f".{self.path.name}.lock")
        self._payload = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"version": MANIFEST_VERSION, "entries": []}
        with self.path.open("r", encoding="utf-8") as stream:
            payload = json.load(stream)
        if not isinstance(payload, dict) or payload.get("version") != MANIFEST_VERSION:
            raise ValueError(f"Manifesto incompatvel: {self.path}")
        if not isinstance(payload.get("entries", []), list):
            raise ValueError(f"Manifesto sem lista de entries: {self.path}")
        return payload

    @contextmanager
    def _lock(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        deadline = time.monotonic() + 30
        descriptor: int | None = None
        while descriptor is None:
            try:
                descriptor = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                os.write(descriptor, str(os.getpid()).encode("ascii"))
            except FileExistsError:
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Lock de manifesto ocupado: {self.lock_path}") from None
                time.sleep(0.05)
        try:
            yield
        finally:
            os.close(descriptor)
            self.lock_path.unlink(missing_ok=True)

    @property
    def entries(self) -> list[dict[str, Any]]:
        return copy.deepcopy(self._payload["entries"])

    def get(self, identity: str) -> dict[str, Any] | None:
        for entry in self._payload["entries"]:
            if entry.get("source_identity") == identity:
                return copy.deepcopy(entry)
        return None

    def _validate_target(self, target: Path) -> str:
        if target.is_absolute() or ".." in target.parts:
            raise ValueError("target_path deve ser relativo ao diretrio Bronze")
        root = self.path.parent.resolve()
        resolved = (root / target).resolve()
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise ValueError("target_path escapa do diretrio Bronze") from exc
        return target.as_posix()

    def register(self, entry: Mapping[str, Any]) -> dict[str, Any]:
        """Adiciona ou completa uma entrada sem permitir drift silencioso."""
        required = ("source_identity", "target_path", "dataset", "uf", "year")
        missing = [field for field in required if not entry.get(field)]
        if missing:
            raise ValueError(f"Entrada de manifesto incompleta: {missing}")
        candidate = copy.deepcopy(dict(entry))
        candidate["target_path"] = self._validate_target(Path(str(entry["target_path"])))
        candidate["year"] = int(candidate["year"])
        candidate["fingerprint"] = _normalise_fingerprint(candidate.get("fingerprint"))
        candidate.setdefault("status", "pending")
        candidate.setdefault("registered_at", datetime.now(UTC).isoformat(timespec="seconds"))
        identity = str(candidate["source_identity"])

        with self._lock():
            self._payload = self._load()
            for existing in self._payload["entries"]:
                same_target = existing.get("target_path") == candidate["target_path"]
                same_identity = existing.get("source_identity") == identity
                if same_target and not same_identity:
                    raise ManifestConflictError(
                        f"Alvo j associado a outra fonte: {candidate['target_path']}"
                    )
                if not same_identity:
                    continue
                if existing.get("target_path") != candidate["target_path"]:
                    raise ManifestConflictError(f"Fonte com alvo incompatvel: {identity}")
                old_fp = _normalise_fingerprint(existing.get("fingerprint"))
                new_fp = candidate["fingerprint"]
                if old_fp and new_fp and old_fp != new_fp:
                    raise ManifestConflictError(f"Drift de contedo para a fonte: {identity}")
                should_update = new_fp and not old_fp
                should_update = should_update or (
                    _STATUS_ORDER.get(candidate["status"], 0)
                    > _STATUS_ORDER.get(existing.get("status", "pending"), 0)
                )
                if should_update:
                    existing.update(candidate)
                _atomic_write_json(self.path, self._payload)
                return copy.deepcopy(existing)

            self._payload["entries"].append(candidate)
            _atomic_write_json(self.path, self._payload)
            return copy.deepcopy(candidate)

    def save(self) -> None:
        with self._lock():
            _atomic_write_json(self.path, self._payload)
