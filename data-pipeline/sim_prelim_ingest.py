"""Ingestao Bronze dos dados PRELIMINARES do SIM (arvore PRELIM/DORES).

Camada complementar, paralela a consolidada — ver docs/DADOS_PRELIMINARES.md.
DADOS PRELIMINARES NUNCA ENTRAM NA MESMA AGREGACAO QUE OS CONSOLIDADOS.

## Caminho escolhido: PySUS Directory apontado para a arvore PRELIM

O PySUS instalado neste projeto e a versao 1.0.1 (`pysus.ftp.databases.sim.SIM`),
cujos `paths` sao hardcoded para CID10/DORES e CID9/DORES — PRELIM nao existe no
mapeamento da classe. Confirmado lendo `pysus/ftp/databases/sim.py`.

A classe `Database.load(directories=[...])` (pysus/ftp/__init__.py) aceita uma
lista explicita de `Directory` que SOBRESCREVE `self.paths` para aquela chamada,
sem precisar subclassear ou modificar o pysus:

    sim = SIM()
    sim.load(directories=[Directory("/dissemin/publicos/SIM/PRELIM/DORES")])

Testado ao vivo contra o FTP oficial (25/26 anos, 27 UFs + 1 arquivo BR agregado
nacional que este modulo ignora): `sim.format(file)` e `sim.describe(file)` ja
decodificam corretamente o nome dos arquivos PRELIM (`DOBA2025.dbc` -> grupo DO,
UF BA, ano 2025), porque o formatter da classe `SIM` fatia o nome posicionalmente
e nao depende da arvore de origem. Nao foi necessario usar `ftplib` manual nem
atualizar o pysus.

Limitacao conhecida deste ambiente de desenvolvimento: a rede sandboxed conseguiu
LISTAR o diretorio PRELIM (comando FTP LIST, via conexao de controle) mas novas
conexoes de controle FTP (incluindo tentativas de RETR) deram timeout de forma
consistente nos testes manuais. O fluxo de download abaixo reaproveita os mesmos
primitivos ja usados em producao pela ingestao consolidada (`_pysus_to_bronze_duckdb`,
`_resolve_pysus_parquet`), mas o download real (RETR) precisa ser validado num
ambiente com conectividade estavel ao FTP do DATASUS.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .datasus import (
    UFS_BRASIL,
    _liberar_memoria,
    _parquet_count,
    _parquet_schema,
    _pysus_to_bronze_duckdb,
    _resolve_pysus_parquet,
    _schema_fingerprint,
)
from .ingestion_manifest import (
    ManifestStore,
    deterministic_part_name,
    file_fingerprint,
    source_identity,
    source_reference,
)
from .logging import get_logger

logger = get_logger(__name__)

PRELIM_FTP_PATH = "/dissemin/publicos/SIM/PRELIM/DORES"
_IGNORAR_UF_AGREGADA = "BR"  # DOBR*.dbc: Brasil inteiro agregado, fora do escopo por-UF


def _prelim_sim_database() -> Any:
    """Instancia SIM do pysus com o conteudo apontado para a arvore PRELIM/DORES."""
    from pysus.ftp import Directory
    from pysus.ftp.databases.sim import SIM

    sim = SIM()
    sim.load(directories=[Directory(PRELIM_FTP_PATH)])
    return sim


def _download_prelim_source(source: Any, dbc_dir: Path) -> tuple[str, dict]:
    """Baixa o .dbc bruto (proveniencia) e retorna (caminho_parquet, fingerprint_dbc).

    Usa `File.download()` diretamente (nao `Database.download()`) para controlar
    o diretorio de destino e poder hashear o .dbc bruto — o pysus converte
    .dbc -> .dbf -> parquet in-place sem apagar o .dbc original.
    """
    dbc_dir.mkdir(parents=True, exist_ok=True)
    parquet_set = source.download(local_dir=str(dbc_dir))
    dbc_path = dbc_dir / getattr(source, "basename", f"{getattr(source, 'name', 'source')}.dbc")
    if not dbc_path.exists():
        raise FileNotFoundError(
            f"Arquivo .dbc bruto nao encontrado apos download (esperado em {dbc_path}); "
            "a proveniencia do arquivo original nao pode ser confirmada."
        )
    dbc_fingerprint = file_fingerprint(dbc_path)
    return _resolve_pysus_parquet(parquet_set), dbc_fingerprint


def _materialize_prelim_file(
    *,
    uf: str,
    year: int,
    source: Any,
    dbc_dir: Path,
    parts_dir: Path,
    manifest: ManifestStore,
) -> int:
    """Materializa um arquivo PRELIM e registra proveniencia do .dbc bruto no manifesto.

    Espelha `datasus._materialize_remote_file`, mas hasheia o .dbc bruto (nao so
    o parquet resultante) e mantem o registro de manifesto num arquivo separado
    (sim_prelim_manifest.json), nunca compartilhado com a ingestao consolidada.
    """
    reference = source_reference(source)
    identity = source_identity("SIM_PRELIM", uf, year, source, group="DO")
    existing = manifest.get(identity)
    target_name = (
        str(existing["target_path"])
        if existing
        else deterministic_part_name("sim_prelim", uf, year, source, group="DO")
    )
    target = parts_dir / target_name
    base = {
        "source_identity": identity,
        "source_reference": reference,
        "dataset": "SIM_PRELIM",
        "group": "DO",
        "uf": uf,
        "year": year,
        "target_path": target_name,
    }

    if existing and target.exists():
        count = _parquet_count(target)
        manifest.register(
            {
                **base,
                "status": "approved",
                "fingerprint": file_fingerprint(target),
                "row_count": count,
                "schema": _parquet_schema(target),
            }
        )
        return count
    if not existing and target.exists():
        raise FileExistsError(f"Alvo deterministico PRELIM ja existe sem manifesto: {target}")

    pending_entry = manifest.register({**base, "status": "pending"})
    extracted_at = pending_entry["registered_at"]
    pysus_path, dbc_fingerprint = _download_prelim_source(source, dbc_dir)
    count = _pysus_to_bronze_duckdb(pysus_path, target, uf)
    schema = _parquet_schema(target)
    manifest.register(
        {
            **base,
            "status": "approved",
            "fingerprint": file_fingerprint(target),
            "row_count": count,
            "schema": schema,
            "schema_fingerprint": _schema_fingerprint(schema),
            "dbc_source_reference": reference,
            "dbc_sha256": dbc_fingerprint["sha256"],
            "dbc_size_bytes": dbc_fingerprint["size"],
            "extracted_at": extracted_at,
        }
    )
    _liberar_memoria()
    return count


def baixar_sim_prelim_streaming(
    ufs: list[str] | None = None,
    anos: list[int] | None = None,
    *,
    allow_partial: bool = False,
) -> Path:
    """Baixa o SIM PRELIMINAR (DORES) em partes deterministicas com manifesto proprio.

    Nunca escreve em data/bronze/sim_parts/ (consolidado) — destino fixo e
    isolado em data/bronze/prelim/. `ufs`/`anos` default para UFS_BRASIL (a
    mesma lista usada pela ingestao consolidada, que ja exclui "BR") e para os
    anos preliminares mais recentes; ajuste conforme o que estiver disponivel
    no FTP no momento da execucao.
    """
    from .config import settings

    ufs = [uf for uf in (ufs or UFS_BRASIL) if uf.upper() != _IGNORAR_UF_AGREGADA]
    anos = anos or [2025, 2026]

    prelim_root = settings.resolve(settings.bronze_dir) / "prelim"
    parts_dir = prelim_root / "sim_parts"
    dbc_dir = prelim_root / "_dbc_raw"
    parts_dir.mkdir(parents=True, exist_ok=True)
    manifest = ManifestStore(parts_dir / "sim_prelim_manifest.json")

    sim = _prelim_sim_database()
    total = 0
    errors: list[str] = []
    for uf in ufs:
        for year in anos:
            try:
                files = sim.get_files("CID10", uf=uf, year=year)
                if not files:
                    logger.warning("sim_prelim_sem_arquivos", uf=uf, ano=year)
                    continue
                for source in files:
                    total += _materialize_prelim_file(
                        uf=uf,
                        year=year,
                        source=source,
                        dbc_dir=dbc_dir,
                        parts_dir=parts_dir,
                        manifest=manifest,
                    )
            except Exception as exc:
                errors.append(f"{uf}/{year}: {exc}")
                logger.error("sim_prelim_erro_download", uf=uf, ano=year, erro=str(exc))

    if total == 0:
        raise ConnectionError(
            "Nenhum dado SIM PRELIMINAR baixado. Verifique o FTP DATASUS "
            f"({PRELIM_FTP_PATH}) e os anos/UFs solicitados."
        )
    if errors and not allow_partial:
        raise RuntimeError(
            f"Ingestao SIM PRELIMINAR incompleta; erros preservados no log: {'; '.join(errors)}"
        )
    logger.info(
        "sim_prelim_streaming_concluido",
        total=total,
        entradas_aprovadas=len(manifest.entries),
        erros=len(errors),
    )
    return parts_dir
