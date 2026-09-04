"""Bridge HTTP para tools do MCP Server.

Permite que o frontend chame as tools MCP via REST,
sem necessidade de conexao stdio/SSE.

Desabilitado em producao por padrao (MCP_BRIDGE_ENABLED=false).
"""

from importlib import import_module

from fastapi import APIRouter, HTTPException

from ..config import settings

router = APIRouter(prefix="/api/mcp", tags=["MCP Bridge"])

srv = import_module("mcp-server.server")


def _require_mcp_bridge() -> None:
    if not settings.mcp_bridge_active:
        raise HTTPException(status_code=404, detail="MCP bridge desabilitado neste ambiente")


@router.get("/query_obitos")
async def mcp_query_obitos(
    municipio: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
):
    _require_mcp_bridge()
    result = srv.query_obitos(municipio=municipio, ano=ano, tipo_veiculo=tipo_veiculo)
    return {"tool": "query_obitos", "result": result}


@router.get("/query_custos")
async def mcp_query_custos(
    municipio: str | None = None,
    ano: int | None = None,
    tipo_veiculo: str | None = None,
):
    _require_mcp_bridge()
    result = srv.query_custos(municipio=municipio, ano=ano, tipo_veiculo=tipo_veiculo)
    return {"tool": "query_custos", "result": result}


@router.get("/query_taxa_mortalidade")
async def mcp_query_taxa(municipio: str | None = None, ano: int = 2023):
    _require_mcp_bridge()
    result = srv.query_taxa_mortalidade(municipio=municipio, ano=ano)
    return {"tool": "query_taxa_mortalidade", "result": result}


@router.get("/query_serie_temporal")
async def mcp_query_serie_temporal(
    municipio: str,
    metrica: str = "obitos",
):
    _require_mcp_bridge()
    result = srv.query_serie_temporal(municipio=municipio, metrica=metrica)
    return {"tool": "query_serie_temporal", "result": result}


@router.get("/listar_municipios")
async def mcp_listar(uf: str | None = None):
    _require_mcp_bridge()
    result = srv.listar_municipios(uf=uf)
    return {"tool": "listar_municipios", "result": result}
