"""Endpoints de previsão de séries temporais com TimesFM."""

from fastapi import APIRouter, HTTPException

from ..services.forecaster import forecast

router = APIRouter(prefix="/api/predict", tags=["Previsão IA"])


@router.get("/obitos/{cod_mun_ibge}")
async def predict_obitos(
    cod_mun_ibge: str,
    ano_inicio: int | None = None,
    ano_fim: int | None = None,
):
    """Previsão de óbitos para os próximos 12 meses via TimesFM.

    Args:
        cod_mun_ibge: Código IBGE do município.
        ano_inicio: Ano inicial do histórico (inclusive). Permite filtrar
            anos com subnotificação.
        ano_fim: Ano final do histórico (inclusive).
    """
    try:
        return forecast(
            metrica="obitos",
            cod_mun_ibge=cod_mun_ibge,
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
    """Previsão de custos ambulatoriais para os próximos 12 meses via TimesFM.

    Args:
        cod_mun_ibge: Código IBGE do município.
        ano_inicio: Ano inicial do histórico (inclusive).
        ano_fim: Ano final do histórico (inclusive).
    """
    try:
        return forecast(
            metrica="custos",
            cod_mun_ibge=cod_mun_ibge,
            ano_inicio=ano_inicio,
            ano_fim=ano_fim,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
