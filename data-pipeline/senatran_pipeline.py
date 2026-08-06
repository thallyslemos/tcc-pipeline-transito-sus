"""ETL independente e auditável da frota municipal SENATRAN.

O pipeline preserva o arquivo oficial na Bronze, normaliza o snapshot de
dezembro na Silver e publica duas Golds: total municipal anual e frota por
tipo. O pareamento municipal é determinístico por UF + nome normalizado e uma
tabela versionada de aliases; correspondências aproximadas nunca são
promovidas automaticamente.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
import zipfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import BinaryIO
from urllib.parse import unquote, urljoin, urlparse

import httpx
import pandas as pd

INDEX_URL = (
    "https://www.gov.br/transportes/pt-br/assuntos/transito/"
    "conteudo-Senatran/estatisticas-frota-de-veiculos-senatran"
)
ANNUAL_PAGE = (
    "https://www.gov.br/transportes/pt-br/assuntos/transito/"
    "conteudo-Senatran/frota-de-veiculos-{year}"
)
HISTORICAL_BUNDLES = {
    2010: "https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/estatisticas/renavam/2010/frota_2010.zip",
    2011: "https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/estatisticas/renavam/2011/frota_2011.zip",
    2012: "https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/estatisticas/renavam/2012/frota_2012.zip",
}
USER_AGENT = "Mozilla/5.0 (compatible; TCC-IFBA-SENATRAN-Audit/1.0)"
VEHICLE_TYPES = (
    "AUTOMOVEL",
    "BONDE",
    "CAMINHAO",
    "CAMINHAO TRATOR",
    "CAMINHONETE",
    "CAMIONETA",
    "CHASSI PLATAF",
    "CICLOMOTOR",
    "MICRO-ONIBUS",
    "MOTOCICLETA",
    "MOTONETA",
    "ONIBUS",
    "QUADRICICLO",
    "REBOQUE",
    "SEMI-REBOQUE",
    "SIDE-CAR",
    "OUTROS",
    "TRATOR ESTEI",
    "TRATOR RODAS",
    "TRICICLO",
    "UTILITARIO",
)
UF_CODE_TO_SIGLA = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}
DECEMBER_TOKENS = ("DEZ", "DEZEMBRO", "DECEMBER")


class SenatranError(RuntimeError):
    """Erro de contrato ou qualidade dos dados SENATRAN."""


@dataclass(frozen=True)
class Resource:
    """Recurso oficial referente ao snapshot anual de dezembro."""

    year: int
    page_url: str
    resource_url: str


@dataclass(frozen=True)
class BronzeArtifact:
    """Metadados suficientes para reproduzir e verificar um download."""

    year: int
    reference_month: int
    page_url: str
    resource_url: str
    local_path: str
    sha256: str
    bytes: int
    downloaded_at_utc: str
    content_type: str | None
    etag: str | None
    last_modified: str | None


class _AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._href: str | None = None
        self._text: list[str] = []
        self.anchors: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, " ".join(self._text)))
            self._href = None
            self._text = []


def normalize_text(value: object) -> str:
    """Normaliza rótulos sem produzir correspondência aproximada."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.upper().replace("D'", "D ")
    return re.sub(r"[^A-Z0-9]+", " ", text).strip()


def _mentions_december(value: object) -> bool:
    normalized = normalize_text(value)
    return any(token in normalized for token in DECEMBER_TOKENS) or bool(
        re.search(r"(?:^|\D)12(?:\D|$)", str(value))
    )


def type_code(label: str) -> str:
    """Converte o rótulo oficial em identificador estável."""
    return normalize_text(label).lower().replace(" ", "_")


def parse_years(spec: str) -> list[int]:
    """Aceita ``2010:2024`` ou lista separada por vírgulas."""
    if ":" in spec:
        start, end = (int(part) for part in spec.split(":", maxsplit=1))
        years = list(range(start, end + 1))
    else:
        years = sorted({int(part.strip()) for part in spec.split(",") if part.strip()})
    if not years or min(years) < 2000 or max(years) > datetime.now(UTC).year:
        raise ValueError("Intervalo de anos inválido")
    return years


def discover_resource(year: int, client: httpx.Client | None = None) -> Resource:
    """Descobre o arquivo oficial de dezembro na página anual."""
    page_url = ANNUAL_PAGE.format(year=year)
    if year in HISTORICAL_BUNDLES:
        return Resource(year, page_url, HISTORICAL_BUNDLES[year])

    owned_client = client is None
    http = client or httpx.Client(follow_redirects=True, timeout=60)
    try:
        response = http.get(page_url, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
    finally:
        if owned_client:
            http.close()

    parser = _AnchorParser()
    parser.feed(response.text)
    candidates: list[tuple[int, str]] = []
    for href, text in parser.anchors:
        combined = normalize_text(f"{text} {unquote(href)}")
        if "FROTA" not in combined or "MUNIC" not in combined:
            continue
        score = 0
        if "TIPO" in combined:
            score += 2
        if "DEZ" in combined or "DECEMBER" in combined:
            score += 5
        if re.search(r"(?:^|\D)12(?:\D|$)", combined):
            score += 1
        candidates.append((score, urljoin(page_url, href)))
    if not candidates:
        raise SenatranError(f"Recurso municipal não encontrado em {page_url}")
    candidates.sort(key=lambda item: item[0], reverse=True)
    return Resource(year, page_url, candidates[0][1])


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resource_suffix(url: str, content_type: str | None) -> str:
    suffix = Path(unquote(urlparse(url).path)).suffix.lower()
    if suffix in {".zip", ".rar", ".xls", ".xlsx"}:
        return suffix
    content = (content_type or "").lower()
    if "zip" in content:
        return ".zip"
    if "rar" in content:
        return ".rar"
    return ".bin"


def download_resource(
    resource: Resource,
    data_root: Path,
    client: httpx.Client | None = None,
) -> BronzeArtifact:
    """Baixa sem sobrescrever a Bronze e registra hash e proveniência."""
    bronze_dir = data_root / "bronze" / "senatran" / str(resource.year)
    bronze_dir.mkdir(parents=True, exist_ok=True)
    owned_client = client is None
    http = client or httpx.Client(follow_redirects=True, timeout=180)
    headers = {"User-Agent": USER_AGENT, "Referer": resource.page_url}
    temp_path: Path | None = None
    try:
        with http.stream("GET", resource.resource_url, headers=headers) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type")
            suffix = _resource_suffix(str(response.url), content_type)
            with tempfile.NamedTemporaryFile(dir=bronze_dir, delete=False) as temp:
                temp_path = Path(temp.name)
                for chunk in response.iter_bytes():
                    temp.write(chunk)
            sha256 = _sha256_file(temp_path)
            destination = bronze_dir / f"senatran_frota_{resource.year}_12_{sha256[:12]}{suffix}"
            if destination.exists():
                temp_path.unlink()
            else:
                os.replace(temp_path, destination)
            artifact = BronzeArtifact(
                year=resource.year,
                reference_month=12,
                page_url=resource.page_url,
                resource_url=resource.resource_url,
                local_path=str(destination),
                sha256=sha256,
                bytes=destination.stat().st_size,
                downloaded_at_utc=datetime.now(UTC).isoformat(),
                content_type=content_type,
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
            )
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()
        if owned_client:
            http.close()
    _update_manifest(data_root, artifact)
    return artifact


def register_local_resource(resource: Resource, source: Path, data_root: Path) -> BronzeArtifact:
    """Incorpora snapshot local na Bronze por cópia, mantendo o original intacto."""
    sha256 = _sha256_file(source)
    bronze_dir = data_root / "bronze" / "senatran" / str(resource.year)
    bronze_dir.mkdir(parents=True, exist_ok=True)
    destination = (
        bronze_dir / f"senatran_frota_{resource.year}_12_{sha256[:12]}{source.suffix.lower()}"
    )
    if not destination.exists():
        shutil.copy2(source, destination)
    artifact = BronzeArtifact(
        year=resource.year,
        reference_month=12,
        page_url=resource.page_url,
        resource_url=resource.resource_url,
        local_path=str(destination),
        sha256=sha256,
        bytes=destination.stat().st_size,
        downloaded_at_utc=datetime.now(UTC).isoformat(),
        content_type=None,
        etag=None,
        last_modified=None,
    )
    _update_manifest(data_root, artifact)
    return artifact


def _update_manifest(data_root: Path, artifact: BronzeArtifact) -> None:
    path = data_root / "bronze" / "senatran" / "manifest.json"
    records = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    key = (artifact.year, artifact.sha256)
    if not any((row["year"], row["sha256"]) == key for row in records):
        records.append(asdict(artifact))
        records.sort(key=lambda row: (row["year"], row["sha256"]))
        _atomic_write_text(path, json.dumps(records, ensure_ascii=False, indent=2) + "\n")


def _magic_kind(path: Path) -> str:
    with path.open("rb") as stream:
        magic = stream.read(8)
    if magic.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(path) as archive:
            return "xlsx" if "[Content_Types].xml" in archive.namelist() else "zip"
    if magic.startswith(b"Rar!\x1a\x07"):
        return "rar"
    if magic.startswith(b"\xd0\xcf\x11\xe0"):
        return "xls"
    if magic.startswith(b"PK"):
        return "xlsx"
    raise SenatranError(f"Formato não reconhecido pela assinatura: {path}")


def _safe_member(name: str) -> bool:
    member = Path(name.replace("\\", "/"))
    return not member.is_absolute() and ".." not in member.parts


def _choose_workbook(names: list[str]) -> str:
    workbooks = [name for name in names if Path(name).suffix.lower() in {".xls", ".xlsx"}]
    if not workbooks:
        raise SenatranError("Pacote oficial sem planilha XLS/XLSX")
    december = [
        name
        for name in workbooks
        if _mentions_december(name) and "MUNIC" in normalize_text(name)
    ]
    if not december:
        raise SenatranError("Pacote oficial sem planilha municipal de dezembro")
    return sorted(december, key=lambda name: (len(name), name))[0]


def validate_reference_period(
    artifact: BronzeArtifact,
    member_name: str,
    sheet_name: str,
) -> dict[str, object]:
    """Exige evidência de dezembro na fonte, sem confiar no nome Bronze gerado."""
    evidence = {
        "resource_url": _mentions_december(artifact.resource_url),
        "workbook_member": _mentions_december(member_name)
        if Path(artifact.local_path).suffix.lower() in {".zip", ".rar"}
        else False,
        "sheet_name": _mentions_december(sheet_name),
    }
    if artifact.reference_month != 12:
        raise SenatranError(
            f"Competência não suportada: mês {artifact.reference_month}; esperado dezembro"
        )
    if not evidence["resource_url"] and not evidence["workbook_member"]:
        raise SenatranError(
            f"{artifact.year}: fonte sem evidência verificável de dezembro "
            f"(recurso={artifact.resource_url!r}, membro={member_name!r})"
        )
    return {
        "reference_month": artifact.reference_month,
        "reference_period_evidence": evidence,
        "sheet_period_label_mismatch": bool(
            _mentions_december(artifact.resource_url) and not evidence["sheet_name"]
        ),
    }


def _extract_workbook(path: Path) -> tuple[BinaryIO | Path, str]:
    kind = _magic_kind(path)
    if kind in {"xls", "xlsx"}:
        return path, path.name
    if kind == "zip":
        archive = zipfile.ZipFile(path)
        unsafe = [name for name in archive.namelist() if not _safe_member(name)]
        if unsafe:
            archive.close()
            raise SenatranError(f"Caminhos inseguros no ZIP: {unsafe[:3]}")
        name = _choose_workbook(archive.namelist())
        payload = io.BytesIO(archive.read(name))
        archive.close()
        return payload, name
    try:
        import rarfile
    except ImportError as exc:  # pragma: no cover - dependência declarada
        raise SenatranError("Instale rarfile para processar a fonte de 2015") from exc
    with rarfile.RarFile(path) as archive:
        names = archive.namelist()
        unsafe = [name for name in names if not _safe_member(name)]
        if unsafe:
            raise SenatranError(f"Caminhos inseguros no RAR: {unsafe[:3]}")
        name = _choose_workbook(names)
        try:
            return io.BytesIO(archive.read(name)), name
        except rarfile.RarCannotExec as exc:
            unrar_free = shutil.which("unrar-free")
            if unrar_free:
                with tempfile.TemporaryDirectory() as temp_dir:
                    subprocess.run(  # noqa: S603
                        [unrar_free, "-x", "-f", str(path), name, temp_dir],
                        check=True,
                        capture_output=True,
                    )
                    extracted = Path(temp_dir) / name
                    if not extracted.is_file():
                        raise SenatranError(
                            f"unrar-free não extraiu a planilha esperada: {name}"
                        ) from exc
                    return io.BytesIO(extracted.read_bytes()), name
            raise SenatranError(
                "O arquivo de 2015 requer 7z/unrar instalado no WSL para extração"
            ) from exc


def _normalize_column(value: object) -> str:
    label = normalize_text(value)
    aliases = {
        "MUNICIPIO": "MUNICIPIO",
        "MUNICIPIO UF": "MUNICIPIO",
        "CAMINHAO TRATOR": "CAMINHAO TRATOR",
        "CHASSI PLATAFORMA": "CHASSI PLATAF",
        "MICRO ONIBUS": "MICRO-ONIBUS",
        "SEMI REBOQUE": "SEMI-REBOQUE",
        "SIDE CAR": "SIDE-CAR",
        "TRATOR DE ESTEIRAS": "TRATOR ESTEI",
        "TRATOR DE RODAS": "TRATOR RODAS",
    }
    return aliases.get(label, label)


def read_official_workbook(path: Path) -> tuple[pd.DataFrame, str, str]:
    """Lê a planilha detectando aba e linha de cabeçalho."""
    source, member_name = _extract_workbook(path)
    member_sha256 = (
        _sha256_file(source)
        if isinstance(source, Path)
        else hashlib.sha256(source.getvalue()).hexdigest()
    )
    sheets = pd.read_excel(source, sheet_name=None, header=None, engine="calamine")
    for sheet_name, raw in sheets.items():
        for row_number in range(min(30, len(raw))):
            header = [_normalize_column(value) for value in raw.iloc[row_number].tolist()]
            if {"UF", "MUNICIPIO", "TOTAL"}.issubset(header) and "MOTOCICLETA" in header:
                frame = raw.iloc[row_number + 1 :].copy()
                frame.columns = header
                frame = frame.loc[:, ~frame.columns.duplicated()].copy()
                frame = frame.dropna(how="all")
                frame["UF"] = frame["UF"].astype(str).str.strip().str.upper()
                frame["MUNICIPIO"] = frame["MUNICIPIO"].astype(str).str.strip()
                valid_geography = (
                    frame["UF"].str.fullmatch(r"[A-Z]{2}", na=False)
                    & ~frame["MUNICIPIO"].map(normalize_text).eq("MUNICIPIO")
                )
                rejected_geography_rows = int((~valid_geography).sum())
                frame = frame[valid_geography].copy()
                required = {"UF", "MUNICIPIO", "TOTAL", *VEHICLE_TYPES}
                missing = sorted(required - set(frame.columns))
                if missing:
                    raise SenatranError(f"Colunas ausentes em {path}: {missing}")
                for column in ("TOTAL", *VEHICLE_TYPES):
                    raw_values = frame[column].astype(str).str.strip()
                    zero_markers = raw_values.str.lower().isin({"", "nan", "none", "-"})
                    cleaned = raw_values.str.replace(r"[^0-9-]", "", regex=True)
                    parsed = pd.to_numeric(cleaned, errors="coerce")
                    invalid = parsed.isna() & ~zero_markers
                    if invalid.any():
                        examples = raw_values[invalid].drop_duplicates().head(5).tolist()
                        raise SenatranError(
                            f"Valores não numéricos em {column} de {path}: {examples}"
                        )
                    frame[column] = parsed.fillna(0).astype("int64")
                result = frame[["UF", "MUNICIPIO", "TOTAL", *VEHICLE_TYPES]].copy()
                result.attrs["rejected_geography_rows"] = rejected_geography_rows
                result.attrs["workbook_member_sha256"] = member_sha256
                return (
                    result,
                    str(sheet_name),
                    member_name,
                )
    raise SenatranError(f"Nenhuma aba municipal reconhecida em {path}")


def load_ibge_dimension(path: Path) -> pd.DataFrame:
    """Carrega a dimensão oficial utilizada pelo projeto com chave de sete dígitos."""
    frame = pd.read_csv(path, sep=None, engine="python", dtype=str)
    normalized = {normalize_text(column): column for column in frame.columns}
    code_col = normalized.get("CODIGO MUNICIPIO COMPLETO") or normalized.get("COD MUN IBGE")
    name_col = normalized.get("NOME MUNICIPIO") or normalized.get("MUNICIPIO")
    uf_col = normalized.get("UF")
    if not all((code_col, name_col, uf_col)):
        raise SenatranError(f"Dimensão IBGE sem colunas esperadas: {list(frame.columns)}")
    result = frame[[code_col, name_col, uf_col]].rename(
        columns={code_col: "cod_mun_ibge", name_col: "municipio_ibge", uf_col: "uf_source"}
    )
    result["cod_mun_ibge"] = result["cod_mun_ibge"].str.replace(r"\D", "", regex=True).str.zfill(7)
    source_uf = result["uf_source"].fillna("").str.strip().str.upper()
    result["uf"] = source_uf.map(UF_CODE_TO_SIGLA).fillna(source_uf)
    result["municipio_key"] = result["municipio_ibge"].map(normalize_text)
    if result["cod_mun_ibge"].duplicated().any():
        raise SenatranError("Dimensão IBGE possui códigos municipais duplicados")
    return result[["cod_mun_ibge", "uf", "municipio_ibge", "municipio_key"]]


def load_aliases(path: Path | None) -> pd.DataFrame:
    """Carrega aliases revisados; arquivo ausente equivale a tabela vazia."""
    columns = [
        "uf",
        "municipio_senatran",
        "municipio_key",
        "cod_mun_ibge",
        "justificativa",
        "fonte",
        "action",
    ]
    if path is None or not path.exists():
        return pd.DataFrame(columns=columns)
    aliases = pd.read_csv(path, dtype=str).fillna("")
    missing = {"uf", "municipio_senatran", "cod_mun_ibge"} - set(aliases.columns)
    if missing:
        raise SenatranError(f"Tabela de aliases incompleta: {sorted(missing)}")
    aliases["uf"] = aliases["uf"].str.upper().str.strip()
    aliases["municipio_key"] = aliases["municipio_senatran"].map(normalize_text)
    aliases["action"] = aliases.get("action", "map").replace("", "map").str.lower()
    invalid_actions = sorted(set(aliases["action"]) - {"map", "quarantine"})
    if invalid_actions:
        raise SenatranError(f"Ações de alias inválidas: {invalid_actions}")
    aliases["cod_mun_ibge"] = aliases["cod_mun_ibge"].str.replace(r"\D", "", regex=True)
    aliases.loc[aliases["cod_mun_ibge"].eq(""), "cod_mun_ibge"] = pd.NA
    mapped = aliases["action"].eq("map")
    if aliases.loc[mapped, "cod_mun_ibge"].isna().any():
        raise SenatranError("Alias com action=map requer cod_mun_ibge")
    aliases.loc[mapped, "cod_mun_ibge"] = aliases.loc[mapped, "cod_mun_ibge"].str.zfill(7)
    if aliases.duplicated(["uf", "municipio_key"]).any():
        raise SenatranError("Tabela de aliases possui chaves duplicadas")
    return aliases


def bridge_municipalities(
    source: pd.DataFrame,
    ibge: pd.DataFrame,
    aliases: pd.DataFrame,
) -> pd.DataFrame:
    """Aplica pareamento exato e aliases versionados, preservando não pareados."""
    aliases = aliases.copy()
    if not aliases.empty:
        if "action" not in aliases.columns:
            aliases["action"] = "map"
        mapped_aliases = aliases[aliases["action"].eq("map")].copy()
        canonical = ibge[["cod_mun_ibge", "uf"]].rename(columns={"uf": "uf_ibge"})
        mapped_aliases = mapped_aliases.merge(canonical, on="cod_mun_ibge", how="left")
        invalid = mapped_aliases[
            mapped_aliases["uf_ibge"].isna()
            | mapped_aliases["uf_ibge"].ne(mapped_aliases["uf"])
        ]
        if not invalid.empty:
            keys = invalid[["uf", "municipio_senatran", "cod_mun_ibge"]].to_dict(
                orient="records"
            )
            raise SenatranError(f"Aliases sem integridade referencial com o IBGE: {keys}")
    frame = source.copy()
    frame["municipio_senatran"] = frame["MUNICIPIO"]
    frame["municipio_key"] = frame["MUNICIPIO"].map(normalize_text)
    counts = ibge.groupby(["uf", "municipio_key"], as_index=False).size()
    ambiguous_keys = set(
        counts.loc[counts["size"] > 1, ["uf", "municipio_key"]].itertuples(index=False, name=None)
    )
    exact = ibge.rename(columns={"cod_mun_ibge": "code_exact", "municipio_ibge": "name_exact"})
    frame = frame.merge(
        exact, left_on=["UF", "municipio_key"], right_on=["uf", "municipio_key"], how="left"
    )
    alias_cols = aliases[["uf", "municipio_key", "cod_mun_ibge", "action"]].rename(
        columns={"cod_mun_ibge": "code_alias", "action": "alias_action"}
    )
    frame = frame.merge(
        alias_cols,
        left_on=["UF", "municipio_key"],
        right_on=["uf", "municipio_key"],
        how="left",
        suffixes=("", "_alias"),
    )
    exact_codes = frame["code_exact"].astype("string")
    alias_codes = frame["code_alias"].astype("string")
    frame["cod_mun_ibge"] = exact_codes.fillna(alias_codes)
    canonical_names = ibge[["cod_mun_ibge", "municipio_ibge"]]
    frame = frame.merge(canonical_names, on="cod_mun_ibge", how="left")
    frame["match_status"] = "unmatched"
    frame.loc[frame["code_alias"].notna(), "match_status"] = "alias"
    frame.loc[frame["code_exact"].notna(), "match_status"] = "exact"
    not_informed = frame["municipio_key"].str.contains("NAO INFORMADO", na=False)
    frame.loc[not_informed, "match_status"] = "not_informed"
    frame.loc[frame["alias_action"].eq("quarantine"), "match_status"] = "quarantined"
    ambiguous = frame.apply(lambda row: (row["UF"], row["municipio_key"]) in ambiguous_keys, axis=1)
    frame.loc[ambiguous & frame["code_alias"].isna(), "match_status"] = "ambiguous"
    return frame


def validate_source(
    frame: pd.DataFrame,
    year: int,
    require_national_coverage: bool = False,
) -> dict[str, object]:
    """Executa gates estruturais e reconciliações aritméticas."""
    if frame.duplicated(["UF", "MUNICIPIO"]).any():
        raise SenatranError(f"{year}: UF + município duplicado na origem")
    numeric = frame[["TOTAL", *VEHICLE_TYPES]]
    negative = int((numeric < 0).sum().sum())
    horizontal_diff = frame["TOTAL"] - frame[list(VEHICLE_TYPES)].sum(axis=1)
    inconsistent = int(horizontal_diff.ne(0).sum())
    if negative or inconsistent:
        raise SenatranError(
            f"{year}: fonte inválida: negativos={negative}, totais_inconsistentes={inconsistent}"
        )
    states = int(frame["UF"].nunique())
    bahia_rows = int(frame["UF"].eq("BA").sum())
    if require_national_coverage and (states != 27 or bahia_rows != 417):
        raise SenatranError(
            f"{year}: cobertura nacional incompleta: UFs={states}, municípios BA={bahia_rows}"
        )
    return {
        "year": year,
        "source_rows": len(frame),
        "states": states,
        "national_total": int(frame["TOTAL"].sum()),
        "negative_values": negative,
        "inconsistent_horizontal_totals": inconsistent,
        "bahia_rows": bahia_rows,
        "bahia_total": int(frame.loc[frame["UF"].eq("BA"), "TOTAL"].sum()),
    }


def normalize_artifact(
    artifact: BronzeArtifact,
    ibge: pd.DataFrame,
    aliases: pd.DataFrame,
    require_national_coverage: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, object]]:
    """Converte um snapshot oficial em Silver longa e base anual total."""
    artifact_path = Path(artifact.local_path)
    if not artifact_path.is_file():
        raise SenatranError(f"Snapshot Bronze ausente: {artifact_path}")
    actual_sha256 = _sha256_file(artifact_path)
    actual_bytes = artifact_path.stat().st_size
    if actual_sha256 != artifact.sha256 or actual_bytes != artifact.bytes:
        raise SenatranError(
            f"Integridade Bronze divergente em {artifact_path}: "
            f"sha={actual_sha256}, bytes={actual_bytes}"
        )
    wide, sheet_name, member_name = read_official_workbook(artifact_path)
    report = validate_source(wide, artifact.year, require_national_coverage)
    report.update(validate_reference_period(artifact, member_name, sheet_name))
    report["rejected_geography_rows"] = int(wide.attrs.get("rejected_geography_rows", 0))
    report["workbook_member_sha256"] = wide.attrs.get("workbook_member_sha256")
    bridged = bridge_municipalities(wide, ibge, aliases)
    match_counts = bridged["match_status"].value_counts().to_dict()
    report.update(
        {
            "source_sha256": artifact.sha256,
            "workbook_member": member_name,
            "sheet_name": sheet_name,
            "match_status": {str(key): int(value) for key, value in match_counts.items()},
            "unmatched": bridged.loc[
                bridged["match_status"].isin(["unmatched", "ambiguous"]),
                ["UF", "municipio_senatran", "TOTAL", "match_status"],
            ].to_dict(orient="records"),
            "not_informed": bridged.loc[
                bridged["match_status"].eq("not_informed"),
                ["UF", "municipio_senatran", "TOTAL"],
            ].to_dict(orient="records"),
        }
    )
    id_vars = ["UF", "municipio_senatran", "cod_mun_ibge", "municipio_ibge", "match_status"]
    long = bridged.melt(
        id_vars=id_vars,
        value_vars=list(VEHICLE_TYPES),
        var_name="tipo_veiculo_senatran",
        value_name="quantidade",
    )
    long["uf"] = long["UF"]
    long["tipo_veiculo_codigo"] = long["tipo_veiculo_senatran"].map(type_code)
    long["ano"] = artifact.year
    long["mes_referencia"] = 12
    long["competencia"] = pd.Timestamp(artifact.year, 12, 1).date()
    long["source_sha256"] = artifact.sha256
    long["source_url"] = artifact.resource_url
    long["page_url"] = artifact.page_url
    long = long[
        [
            "cod_mun_ibge",
            "uf",
            "municipio_ibge",
            "municipio_senatran",
            "ano",
            "mes_referencia",
            "competencia",
            "tipo_veiculo_codigo",
            "tipo_veiculo_senatran",
            "quantidade",
            "match_status",
            "source_sha256",
            "source_url",
            "page_url",
        ]
    ]
    annual = bridged.copy()
    annual["uf"] = annual["UF"]
    annual["frota_total"] = annual["TOTAL"]
    annual["ano"] = artifact.year
    annual["mes_referencia"] = 12
    annual["competencia"] = pd.Timestamp(artifact.year, 12, 1).date()
    annual["frota_duas_rodas_motorizadas"] = (
        annual["MOTOCICLETA"] + annual["MOTONETA"] + annual["CICLOMOTOR"]
    )
    annual["source_sha256"] = artifact.sha256
    annual["source_url"] = artifact.resource_url
    annual = annual[
        [
            "cod_mun_ibge",
            "uf",
            "municipio_ibge",
            "municipio_senatran",
            "ano",
            "mes_referencia",
            "competencia",
            "frota_total",
            *VEHICLE_TYPES,
            "frota_duas_rodas_motorizadas",
            "match_status",
            "source_sha256",
            "source_url",
        ]
    ]
    return long, annual, report


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp:
        temp.write(text)
        temp_path = Path(temp.name)
    os.replace(temp_path, path)


def _atomic_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".parquet", delete=False) as temp:
        temp_path = Path(temp.name)
    try:
        frame.to_parquet(temp_path, index=False)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _merge_years(
    current: pd.DataFrame,
    path: Path,
    keys: list[str],
) -> pd.DataFrame:
    """Substitui somente os anos processados e preserva os demais anos publicados."""
    current = current.copy()
    if "competencia" in current:
        current["competencia"] = pd.to_datetime(current["competencia"]).dt.date
    if path.exists():
        existing = pd.read_parquet(path)
        if set(existing.columns) != set(current.columns):
            raise SenatranError(f"Schema existente incompatível para atualização parcial: {path}")
        existing = existing[current.columns].copy()
        if "competencia" in existing:
            existing["competencia"] = pd.to_datetime(existing["competencia"]).dt.date
        replaced_years = set(current["ano"].astype(int))
        existing = existing[~existing["ano"].astype(int).isin(replaced_years)]
        current = pd.concat([existing, current], ignore_index=True)
    if current.duplicated(keys).any():
        raise SenatranError(f"Chaves duplicadas após atualização parcial de {path.name}")
    return current.sort_values(keys, kind="stable").reset_index(drop=True)


def _merge_quality_reports(path: Path, reports: list[dict[str, object]]) -> list[dict[str, object]]:
    replaced_years = {int(report["year"]) for report in reports}
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    kept = [report for report in existing if int(report["year"]) not in replaced_years]
    return sorted([*kept, *reports], key=lambda report: int(report["year"]))


def publish_products(
    artifacts: list[BronzeArtifact],
    data_root: Path,
    municipalities_csv: Path,
    aliases_csv: Path | None,
    allow_unmatched: bool = False,
    require_national_coverage: bool = True,
) -> dict[str, Path]:
    """Materializa Silver, Golds e relatório de QA de forma atômica."""
    ibge = load_ibge_dimension(municipalities_csv)
    aliases = load_aliases(aliases_csv)
    silver_parts: list[pd.DataFrame] = []
    annual_parts: list[pd.DataFrame] = []
    reports: list[dict[str, object]] = []
    for artifact in sorted(artifacts, key=lambda item: item.year):
        long, annual, report = normalize_artifact(
            artifact,
            ibge,
            aliases,
            require_national_coverage=require_national_coverage,
        )
        silver_parts.append(long)
        annual_parts.append(annual)
        reports.append(report)
    unresolved = sum(
        len(report["unmatched"])
        for report in reports  # type: ignore[arg-type]
    )
    if unresolved and not allow_unmatched:
        report_path = data_root / "quality" / "senatran_frota_qa.json"
        merged_reports = _merge_quality_reports(report_path, reports)
        _atomic_write_text(
            report_path, json.dumps(merged_reports, ensure_ascii=False, indent=2) + "\n"
        )
        raise SenatranError(
            f"Há {unresolved} município-ano não pareados. Revise {report_path} e os aliases."
        )
    silver = pd.concat(silver_parts, ignore_index=True)
    annual = pd.concat(annual_parts, ignore_index=True)
    accepted = annual[annual["match_status"].isin(["exact", "alias"])].copy()
    if accepted.duplicated(["cod_mun_ibge", "ano"]).any():
        raise SenatranError("Gold teria mais de uma linha por município e ano")
    gold_types = silver[silver["match_status"].isin(["exact", "alias"])].copy()
    if gold_types.duplicated(["cod_mun_ibge", "ano", "tipo_veiculo_codigo"]).any():
        raise SenatranError("Gold por tipo teria chaves duplicadas")
    paths = {
        "silver": data_root / "silver" / "senatran_frota_municipio_tipo.parquet",
        "gold_total": data_root / "gold" / "frota_municipio_ano.parquet",
        "gold_type": data_root / "gold" / "frota_municipio_ano_tipo.parquet",
        "quality": data_root / "quality" / "senatran_frota_qa.json",
    }
    silver = _merge_years(
        silver,
        paths["silver"],
        ["ano", "uf", "municipio_senatran", "tipo_veiculo_codigo"],
    )
    accepted = _merge_years(accepted, paths["gold_total"], ["ano", "cod_mun_ibge"])
    gold_types = _merge_years(
        gold_types,
        paths["gold_type"],
        ["ano", "cod_mun_ibge", "tipo_veiculo_codigo"],
    )
    reports = _merge_quality_reports(paths["quality"], reports)
    _atomic_parquet(silver, paths["silver"])
    _atomic_parquet(accepted, paths["gold_total"])
    _atomic_parquet(gold_types, paths["gold_type"])
    _atomic_write_text(paths["quality"], json.dumps(reports, ensure_ascii=False, indent=2) + "\n")
    return paths


def run_pipeline(
    years: list[int],
    data_root: Path,
    municipalities_csv: Path,
    aliases_csv: Path | None,
    allow_unmatched: bool = False,
    reuse_local_dir: Path | None = None,
) -> dict[str, Path]:
    """Descobre, baixa, normaliza e publica os anos solicitados."""
    artifacts: list[BronzeArtifact] = []
    for year in years:
        resource = discover_resource(year)
        local_candidates = (
            [
                path
                for path in reuse_local_dir.iterdir()
                if path.is_file() and str(year) in path.name
            ]
            if reuse_local_dir and reuse_local_dir.exists()
            else []
        )
        if len(local_candidates) > 1:
            raise SenatranError(
                f"Mais de um snapshot local candidato para {year}: {local_candidates}"
            )
        artifact = (
            register_local_resource(resource, local_candidates[0], data_root)
            if local_candidates
            else download_resource(resource, data_root)
        )
        artifacts.append(artifact)
    return publish_products(
        artifacts,
        data_root,
        municipalities_csv,
        aliases_csv,
        allow_unmatched=allow_unmatched,
        require_national_coverage=True,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", default="2010:2024", help="Ex.: 2010:2024 ou 2023,2024")
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--municipalities-csv", type=Path, required=True)
    parser.add_argument("--aliases-csv", type=Path)
    parser.add_argument(
        "--reuse-local-dir",
        type=Path,
        help="Diretório somente leitura com snapshots já obtidos; os originais são copiados.",
    )
    parser.add_argument(
        "--allow-unmatched",
        action="store_true",
        help="Publica excluindo não pareados; o padrão bloqueia a Gold.",
    )
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    paths = run_pipeline(
        parse_years(args.years),
        args.data_root.resolve(),
        args.municipalities_csv.resolve(),
        args.aliases_csv.resolve() if args.aliases_csv else None,
        args.allow_unmatched,
        args.reuse_local_dir.resolve() if args.reuse_local_dir else None,
    )
    print(json.dumps({key: str(value) for key, value in paths.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
