"""Endpoints de previsão de séries temporais com TimesFM.

Desabilitado em producao por padrao (PREDICT_ENABLED=false).
"""

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..routers.utils import cod6_seguro
from ..services.forecaster import forecast

router = APIRouter(prefix="/api/predict", tags=["Previsão IA"])


def _require_predict() -> None:
    if not settings.predict_active:
        raise HTTPException(status_code=404, detail="Previsao TimesFM desabilitada neste ambiente")


@router.get("/obitos/{cod_mun_ibge}")
async def predict_obitos(
    cod_mun_ibge: str,
    ano_inicio: int | None = None,
    ano_fim: int | None = None,
):
    """Previsão de óbitos para os próximos 12 meses via TimesFM."""
    _require_predict()
    cod6 = cod6_seguro(cod_mun_ibge)
    if not cod6:
        raise HTTPException(status_code=422, detail="cod_mun_ibge invalido")
    try:
        return forecast(
            metrica="obitos",
            cod_mun_ibge=cod6,
            ano_inicio=ano_inicio,
            ano_fim=ano_fim,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/custos/{cod_mun_ibge}")
async def predict_custos(
    cod_mun_ibge: str,
    ano_inicio: int | None = None,
    ano_fim: int | None = None,
):
    """Previsão de custos ambulatoriais para os próximos 12 meses via TimesFM."""
    _require_predict()
    cod6 = cod6_seguro(cod_mun_ibge)
    if not cod6:
        raise HTTPException(status_code=422, detail="cod_mun_ibge invalido")
    try:
        return forecast(
            metrica="custos",
            cod_mun_ibge=cod6,
            ano_inicio=ano_inicio,
            ano_fim=ano_fim,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
