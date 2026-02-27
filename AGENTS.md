# AGENTS.md

## Cursor Cloud specific instructions

### Visão geral

Pipeline analítico de acidentes de trânsito no SUS (DATASUS). Monorepo Python com DuckDB, FastAPI, FastMCP e PySUS. Consulte `README.md` para stack completa e `ARCHITECTURE.md` para fluxo de dados Medallion.

### Ferramentas e dependências

- **Python 3.12+** com **uv** como gerenciador de pacotes (`pyproject.toml` na raiz).
- `uv sync` instala todas as dependências (prod + dev).
- Requer `python3-dev` e `libffi-dev` no sistema para compilar `cffi` (dependência de PySUS).

### Comandos essenciais

| Ação | Comando |
|------|---------|
| Instalar deps | `uv sync` |
| Lint | `uv run ruff check .` |
| Lint fix | `uv run ruff check --fix .` |
| Format | `uv run ruff format .` |
| Testes | `uv run pytest tests/ -v` |
| Backend (dev) | `uv run uvicorn backend.app:app --reload --port 8000` |

### Caveats

- **PySUS** tenta conectar ao FTP do DATASUS (`ftp.datasus.gov.br`) na importação de `pysus.online_data.SIM` / `SIA`. Em ambientes sem acesso FTP (sandbox, CI), importe apenas `pysus` (nível raiz) ou `pyreaddbc` para verificar instalação.
- **DuckDB** roda embutido (in-process), sem servidor externo necessário.
- Dados `.parquet` e `.dbc` ficam em `data/` (no `.gitignore`).
