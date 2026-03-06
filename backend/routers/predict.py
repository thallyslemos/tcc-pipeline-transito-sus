"""Endpoints de previsão de séries temporais com TimesFM."""

from fastapi import APIRouter, HTTPException

from ..services.forecaster import forecast

router = APIRouter(prefix="/api/predict", tags=["Previsão IA"])


@router.get("/obitos/{cod_mun_ibge}")
async def predict_obitos(cod_mun_ibge: str):
    """Previsão de óbitos para os próximos 12 meses via TimesFM."""
    try:
        return forecast(metrica="obitos", cod_mun_ibge=cod_mun_ibge)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/custos/{cod_mun_ibge}")
async def predict_custos(cod_mun_ibge: str):
    """Previsão de custos ambulatoriais para os próximos 12 meses via TimesFM."""
    try:
        return forecast(metrica="custos", cod_mun_ibge=cod_mun_ibge)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
