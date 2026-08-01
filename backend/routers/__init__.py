"""Registro dos routers carregados pela aplicação FastAPI."""

from . import auditoria, dashboard

# O dashboard já é incluído pela aplicação com o prefixo /api/dashboard.
# A auditoria fica aninhada nele para evitar tocar no app.py, que pode conter
# mudanças locais independentes do contrato desta entrega.
dashboard.router.include_router(auditoria.router)

__all__ = ["auditoria", "dashboard"]
