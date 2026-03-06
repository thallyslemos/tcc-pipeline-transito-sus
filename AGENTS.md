# AGENTS.md

## Cursor Cloud specific instructions

### Visao geral

Pipeline analitico de acidentes de transito no SUS (DATASUS). Monorepo Python + Next.js com DuckDB, FastAPI e PySUS. Consulte `README.md` para stack completa e `ARCHITECTURE.md` para fluxo de dados Medallion.

### Servicos

| Servico | Porta | Comando |
|---------|-------|---------|
| Backend (FastAPI) | 8000 | `uv run uvicorn backend.app:app --reload --port 8000` |
| Frontend (Next.js) | 3000 | `cd frontend && npm run dev` |

O backend deve estar rodando antes do frontend (o frontend consome a API).

### Comandos essenciais

| Acao | Comando |
|------|---------|
| Instalar deps Python | `uv sync` |
| Instalar deps Frontend | `cd frontend && npm install` |
| Lint Python | `uv run ruff check .` |
| Format Python | `uv run ruff format .` |
| Testes | `uv run pytest tests/ -v` |
| Executar pipeline ETL | `uv run python -c "from importlib import import_module; import_module('data-pipeline.run').main()"` |
| Build frontend | `cd frontend && npx next build` |

### Configuracao

- Pydantic Settings carrega `.env` na raiz. Copie `.env.example` para `.env`.
- Frontend usa `.env.local` dentro de `frontend/`.
- Variaveis de ambiente documentadas em `.env.example`.

### Caveats

- **PySUS** tenta conectar ao FTP do DATASUS na importacao de `pysus.online_data.SIM`/`SIA`. Em sandbox, importe apenas `pysus` (nivel raiz) ou `pyreaddbc`.
- **PySUS cache**: Arquivos baixados ficam em `~/pysus/` (ex: `DOBA2024.parquet`). Isso é comportamento padrão do PySUS, não um problema.
- **DuckDB** roda in-process, sem servidor externo.
- O diretorio `data-pipeline` tem hifen no nome. Para importar em Python: `from importlib import import_module; mod = import_module('data-pipeline.modulo')`.
- Dados `.parquet` ficam em `data/` (gitignored). Execute o pipeline ETL para gerar.
- Requer `python3-dev` e `libffi-dev` no sistema para compilar `cffi` (dep do PySUS).
- **Pipeline real (streaming)**: `run_real()` usa `baixar_sim_streaming()` / `baixar_sia_streaming()` que salvam cada arquivo PySUS individualmente em `data/bronze/sim_parts/` e `data/bronze/sia_parts/`, liberando memória entre downloads. O Silver lê via DuckDB glob (`*.parquet`). SIM e SIA são processados sequencialmente, nunca simultâneos em memória.
- **DTOBITO (SIM)**: Nos dados reais do DATASUS, `DTOBITO` vem como string `DDMMYYYY` (ex: `"11042024"`). O Silver converte via `TRY_STRPTIME(DTOBITO, '%d%m%Y')` com fallback `TRY_CAST(DTOBITO AS DATE)` para dados amostrais.
- **Chat + MCP**: O chat usa Ollama tool calling para consultar dados via MCP bridge (`/api/mcp/*`). Sem Ollama, usa consultas diretas na API. Sim, é possível o Ollama consumir o MCP: o frontend define as 5 MCP tools como `tools` na request do Ollama, executa cada tool call via HTTP bridge, e retorna os resultados ao modelo.
- **Previsão IA (TimesFM)**: Endpoint `/api/predict/{obitos|custos}/{cod_mun_ibge}` carrega o modelo `google/timesfm-1.0-200m-pytorch` (lazy, singleton). Primeiro request leva ~30s (download do modelo). Exige mínimo 24 meses de histórico.
- Frontend usa Leaflet (client-only). O componente `MapView` usa `dynamic import` com `ssr: false`.
- Sample data cobre 9 municipios em 3 estados (SP, MG, BA) com coordenadas lat/lon.
- O `FilterBar` e desacoplado: recebe `filters[]` como prop, nao conhece o dominio.
