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
| Executar pipeline ETL | `uv run python -c "from importlib import import_module; import_module('data-pipeline.run').run()"` |
| Build frontend | `cd frontend && npx next build` |

### Configuracao

- Pydantic Settings carrega `.env` na raiz. Copie `.env.example` para `.env`.
- Frontend usa `.env.local` dentro de `frontend/`.
- Variaveis de ambiente documentadas em `.env.example`.

### Caveats

- **PySUS** tenta conectar ao FTP do DATASUS na importacao de `pysus.online_data.SIM`/`SIA`. Em sandbox, importe apenas `pysus` (nivel raiz) ou `pyreaddbc`.
- **DuckDB** roda in-process, sem servidor externo.
- O diretorio `data-pipeline` tem hifen no nome. Para importar em Python: `from importlib import import_module; mod = import_module('data-pipeline.modulo')`.
- Dados `.parquet` ficam em `data/` (gitignored). Execute o pipeline ETL para gerar.
- Requer `python3-dev` e `libffi-dev` no sistema para compilar `cffi` (dep do PySUS).
