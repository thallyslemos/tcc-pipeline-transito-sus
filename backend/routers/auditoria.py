"""Endpoints de auditoria metodológica para o painel analítico."""

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..services.onsv_audit import build_onsv_audit_report

router = APIRouter(prefix="/auditoria", tags=["Auditoria"])


@router.get("/onsv-2024")
async def auditoria_onsv_2024() -> dict:
    """Compara a metodologia ONSV com os arquivos Bronze locais deduplicados."""

    bronze_dir = settings.resolve("data/bronze/sim_parts")
    try:
        return build_onsv_audit_report(bronze_dir)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Artefatos Bronze do SIM indisponíveis para a auditoria local.",
        ) from exc
