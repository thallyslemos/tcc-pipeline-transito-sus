## Visao geral do projeto

Este repositorio implementa um **pipeline analitico de acidentes de transito no SUS (DATASUS)**,
organizado em arquitetura Medallion (Bronze → Silver → Gold) com:

- **Backend** `FastAPI` expondo uma API para dashboards e indicadores.
- **Pipeline de dados** em Python + DuckDB lendo/dumpando Parquet.
- **Frontend** em `Next.js` para visualizacao (dashboards, mapa, detalhe por municipio, chat).
- **MCP Server** (`mcp-server/server.py`) para que LLMs consultem o DuckDB via Model Context Protocol.

Para uma explicacao profunda da arquitetura (camadas, tabelas, indicadores e fontes),
veja `ARCHITECTURE.md`.

---

## Como rodar o projeto

Para o passo a passo completo (instalacao de Python/Node, `uv`, setup de ambiente, comandos
para gerar dados e subir backend/frontend/chat), use o guia dedicado:

- **Guia completo de setup**: `docs/SETUP.md`

Em resumo, o fluxo padrao de desenvolvimento e:

1. **Instalar dependencias Python**  
   ```bash
   uv sync
   ```
2. **Instalar dependencias do frontend**  
   ```bash
   cd frontend
   npm install
   cd ..
   ```
3. **Gerar dados amostrais (rapido, sem internet)**  
   ```bash
   uv run python -m data-pipeline.run
   ```
4. **Rodar backend FastAPI**  
   ```bash
   uv run uvicorn backend.app:app --reload --port 8000
   ```
5. **Rodar frontend Next.js**  
   ```bash
   cd frontend
   npm run dev
   ```

URLs principais:

- Backend: `http://localhost:8000` (health) e `http://localhost:8000/docs` (Swagger).
- Frontend: `http://localhost:3000` (`/dashboard`, `/municipio`, `/mapa`, `/chat`).

---

## Documentacao relacionada

- **`docs/SETUP.md`**: guia completo de configuracao local (Windows/macOS/Linux), comandos do dia a dia.
- **`ARCHITECTURE.md`**: arquitetura do pipeline, modelo de dados Gold, integracao com IBGE (localidades, malhas, SIDRA).
- **`FINANCEIRO.md`**: definicoes de custos, metodos de agregacao e referencias de calculos financeiros.
- **`AGENTS.md`**: instrucoes especificas para uso com agentes (por exemplo, Cursor/LLMs) e comandos uteis.
- **`mcp-server/server.py`**: implementacao do MCP Server (FastMCP) com tools como `query_obitos`, `query_custos`,
  `query_taxa_mortalidade`, `query_serie_temporal` e `listar_municipios`.

---

## Servicos principais

| Servico              | Porta | Comando                                                                 |
|----------------------|-------|-------------------------------------------------------------------------|
| Backend (FastAPI)    | 8000  | `uv run uvicorn backend.app:app --reload --port 8000`                  |
| Frontend (Next.js)   | 3000  | `cd frontend && npm run dev`                                            |
| MCP Server (FastMCP) | N/A   | `uv run python -m mcp-server.server`                                   |

Os caminhos de dados (Parquet) sao configurados via `.env` e documentados em `ARCHITECTURE.md`
e em `docs/SETUP.md`.

---

## Testes e qualidade

- **Rodar todos os testes**:
  ```bash
  uv run pytest tests/ -v
  ```
- **Lint Python (ruff)**:
  ```bash
  uv run ruff check .
  ```
- **Formatar Python (ruff format)**:
  ```bash
  uv run ruff format .
  ```

Todos os testes do pipeline, API e stack basica estao em `tests/`.

