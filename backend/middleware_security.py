"""Middleware de segurança: headers HTTP e rate limiting in-memory."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from .config import Settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Headers de endurecimento recomendados para API e assets."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()",
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limit simples por IP (janela deslizante 60s)."""

    def __init__(self, app, *, requests_per_minute: int = 60, heavy_paths: frozenset[str]) -> None:
        super().__init__(app)
        self.rpm = max(requests_per_minute, 1)
        self.heavy_rpm = max(requests_per_minute // 6, 5)
        self.heavy_paths = heavy_paths
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    def _allow(self, key: str, limit: int) -> bool:
        now = time.monotonic()
        window_start = now - 60.0
        bucket = [t for t in self._hits[key] if t >= window_start]
        if len(bucket) >= limit:
            self._hits[key] = bucket
            return False
        bucket.append(now)
        self._hits[key] = bucket
        return True

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path == "/":
            return await call_next(request)

        ip = self._client_ip(request)
        path = request.url.path
        is_heavy = any(path.startswith(p) for p in self.heavy_paths)
        limit = self.heavy_rpm if is_heavy else self.rpm
        bucket_key = f"{ip}:{'heavy' if is_heavy else 'std'}"

        if not self._allow(bucket_key, limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Limite de requisicoes excedido. Tente novamente em instantes."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)


def validate_production_settings(cfg: Settings) -> None:
    """Falha na subida se produção estiver mal configurada."""
    if cfg.app_env != "production":
        return
    origins = [o.strip() for o in cfg.cors_origins.split(",") if o.strip()]
    if not origins:
        msg = "CORS_ORIGINS obrigatorio em APP_ENV=production"
        raise RuntimeError(msg)
    for origin in origins:
        if origin == "*":
            msg = "CORS_ORIGINS nao pode conter '*' em producao"
            raise RuntimeError(msg)
        if "localhost" in origin or "127.0.0.1" in origin:
            msg = f"CORS_ORIGINS invalido em producao: {origin}"
            raise RuntimeError(msg)
