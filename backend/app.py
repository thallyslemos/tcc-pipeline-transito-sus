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
from .routers import dashboard, indicadores, mcp_bridge


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
    _setup_logging()
    logger = structlog.get_logger("backend")
    logger.info("backend_iniciando", env=settings.app_env)
    get_connection()
    logger.info("backend_pronto", port=settings.backend_port)
    yield
    close_connection()
    logger.info("backend_encerrado")


app = FastAPI(
    title="Pipeline Acidentes de Trânsito no SUS",
    description=(
        "API REST do MVP — Impacto econômico e macrotendências de "
        "acidentes de trânsito nas bases do DATASUS (SIM e SIA)."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(indicadores.router)
app.include_router(mcp_bridge.router)


@app.get("/", tags=["Health"])
async def root():
    """Health check."""
    return {
        "status": "ok",
        "service": "Pipeline Analítico de Acidentes de Trânsito no SUS",
        "version": "0.1.0",
    }
