"""Aplicação FastAPI — Pipeline Analítico de Acidentes de Trânsito no SUS.

Ponto de entrada do backend. Configura CORS, logging estruturado,
routers e ciclo de vida do DuckDB.
"""

import logging
import sys
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import close_connection, get_connection
from .middleware_security import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    validate_production_settings,
)
from .routers import (
    dashboard,
    geo,
    indicadores,
    mcp_bridge,
    predict,
    senatran,
    sim_only,
    sim_prelim,
    sim_temporal,
)

_HEAVY_PATHS = frozenset({"/api/predict", "/api/mcp", "/api/sim/temporal/outliers"})


def _setup_logging() -> None:
    """Configura logging estruturado (console dev / JSON prod)."""
    if settings.app_env == "production":
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(settings.log_level.upper())

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Gerencia ciclo de vida: inicializa DuckDB no startup, fecha no shutdown."""
    validate_production_settings(settings)
    _setup_logging()
    logger = structlog.get_logger("backend")
    logger.info(
        "backend_iniciando",
        env=settings.app_env,
        mcp_bridge=settings.mcp_bridge_active,
        predict=settings.predict_active,
    )
    get_connection()
    logger.info("backend_pronto", port=settings.backend_port)
    yield
    close_connection()
    logger.info("backend_encerrado")


app = FastAPI(
    title="Pipeline Acidentes de Trânsito no SUS",
    description=(
        "API REST do contrato de evidencia SIM-only: mortalidade por "
        "acidentes de transporte terrestre, dimensoes IBGE e metadados."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.rate_limit_rpm,
    heavy_paths=_HEAVY_PATHS,
)

app.include_router(dashboard.router)
app.include_router(geo.router)
app.include_router(indicadores.router)
if settings.mcp_bridge_active:
    app.include_router(mcp_bridge.router)
if settings.predict_active:
    app.include_router(predict.router)
app.include_router(sim_only.router)
app.include_router(sim_temporal.router)
app.include_router(sim_prelim.router)
app.include_router(senatran.router)


@app.get("/", tags=["Health"])
async def root():
    """Health check."""
    return {
        "status": "ok",
        "service": "Pipeline Analítico de Acidentes de Trânsito no SUS",
        "version": "0.1.0",
        "security": {
            "mcp_bridge": settings.mcp_bridge_active,
            "predict": settings.predict_active,
        },
    }
