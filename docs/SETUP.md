# Guia Completo de Configuracao Local

Passo a passo para rodar o Pipeline Analitico de Acidentes de Transito no SUS
no seu computador (Windows, macOS ou Linux).

---

## Requisitos do Sistema

| Requisito | Minimo | Recomendado |
|-----------|--------|-------------|
| RAM | 4 GB | 8 GB (16 GB se usar Ollama) |
| Disco | 2 GB | 10 GB (com dados reais) |
| Python | 3.12+ | 3.12 |
| Node.js | 18+ | 22+ |
| SO | Windows 10/11, macOS 12+, Ubuntu 22+ | Qualquer |

---

## Passo 1: Instalar Ferramentas Base

### 1.1 Python 3.12

**Windows:**
```bash
# Baixe de https://www.python.org/downloads/
# Na instalacao, MARQUE "Add Python to PATH"
```

**macOS:**
```bash
brew install python@3.12
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3.12 python3.12-venv python3-dev libffi-dev
```

### 1.2 Node.js 22

**Todas as plataformas:**
```bash
# Baixe de https://nodejs.org/ (versao LTS)
# Ou via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
```

### 1.3 uv (Gerenciador de pacotes Python)

```bash
# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Apos instalar, feche e reabra o terminal para que o `uv` esteja no PATH.

Verifique:
```bash
python3 --version   # deve ser 3.12+
node --version       # deve ser 18+
uv --version         # deve aparecer a versao
```

---

## Passo 2: Clonar o Repositorio

```bash
git clone https://github.com/thallyslemos/tcc-pipeline-transito-sus.git
cd tcc-pipeline-transito-sus
```

Se estiver na branch de desenvolvimento:
```bash
git checkout cursor/development-environment-setup-df58
```

---

## Passo 3: Configurar Variaveis de Ambiente

```bash
# Copiar o arquivo de exemplo
cp .env.example .env
```

O `.env` padrao ja funciona para desenvolvimento local. Nao precisa alterar nada.

---

## Passo 4: Instalar Dependencias Python

```bash
# Na raiz do projeto
uv sync
```

Isso cria um ambiente virtual em `.venv/` e instala todas as dependencias
(PySUS, DuckDB, FastAPI, FastMCP, pandas, etc).

> **Nota Windows:** Se `cffi` falhar ao compilar, instale o
> [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
> com o workload "Desktop development with C++".

---

## Passo 5: Instalar Dependencias do Frontend

```bash
cd frontend
npm install
cd ..
```

---

## Passo 6: Gerar os Dados (Pipeline ETL)

### Opcao A: Dados Amostrais (rapido, sem internet)

```bash
uv run python -c "from importlib import import_module; import_module('data-pipeline.run').main()"
```

Gera dados sinteticos para 9 municipios (SP, MG, BA), 2019-2023.
Leva ~2 segundos.

### Opcao B: Dados Reais do DATASUS (requer internet)

```bash
# Bahia, 2022-2023
uv run python -c "
from importlib import import_module
m = import_module('data-pipeline.run')
m.run_real(ufs=['BA'], anos=[2022, 2023])
"

# SP + MG + BA, 2019-2023 (download grande, pode levar 30+ minutos)
uv run python -c "
from importlib import import_module
m = import_module('data-pipeline.run')
m.run_real(ufs=['SP', 'MG', 'BA'], anos=[2019, 2020, 2021, 2022, 2023])
"

# Brasil completo (MUITO grande, horas de download)
uv run python -c "
from importlib import import_module
m = import_module('data-pipeline.run')
m.run_real(ufs=['ALL'], anos=[2023])
"
```

> **Nota:** O FTP do DATASUS pode ser lento ou instavel. Se falhar,
> tente novamente em outro horario.

Apos rodar, verifique que os arquivos Parquet foram criados:
```bash
ls -la data/gold/
# Deve mostrar:
#   obitos_municipio_mes.parquet
#   custos_municipio_mes.parquet
```

---

## Passo 7: Verificar que Tudo Funciona

```bash
# Rodar testes
uv run pytest tests/ -v

# Rodar lint
uv run ruff check .

# Espere ver: "27 passed" e "All checks passed!"
```

---

## Passo 8: Iniciar o Backend (FastAPI)

```bash
uv run uvicorn backend.app:app --reload --port 8000
```

O backend estara disponivel em **http://localhost:8000**.

Teste no navegador:
- http://localhost:8000 (health check)
- http://localhost:8000/docs (documentacao Swagger)
- http://localhost:8000/api/dashboard/summary (dados do dashboard)

> **Dica:** Mantenha este terminal aberto. Abra um NOVO terminal para o proximo passo.

---

## Passo 9: Iniciar o Frontend (Next.js)

Em um **novo terminal**, na raiz do projeto:

```bash
cd frontend
npm run dev
```

O frontend estara disponivel em **http://localhost:3000**.

Paginas:
- http://localhost:3000/dashboard (painel geral)
- http://localhost:3000/municipio (visao por cidade)
- http://localhost:3000/mapa (mapa de calor)
- http://localhost:3000/chat (chat IA)

---

## Passo 10 (Opcional): Configurar Ollama para Chat IA

Para usar o chat com IA generativa local (sem custo, sem API key):

### 10.1 Instalar Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Windows
# Baixe de https://ollama.com/download
```

### 10.2 Baixar o Modelo

```bash
# Qwen2.5 3B (recomendado - leve, funciona em CPU)
ollama pull qwen2.5:3b

# Alternativa maior (melhor qualidade, precisa de mais RAM)
ollama pull qwen2.5:7b
```

### 10.3 Iniciar o Ollama

```bash
ollama serve
```

> O Ollama roda na porta 11434 por padrao.

### 10.4 Usar no Chat

1. Abra http://localhost:3000/chat
2. O campo "Ollama" ja vem preenchido com `http://localhost:11434`
3. O modelo ja vem como `qwen2.5:3b`
4. Clique em **Conectar**
5. Se o indicador ficar verde, esta conectado!
6. Pergunte: "Qual a taxa de mortalidade em Salvador em 2023?"

> **Sem Ollama:** O chat funciona mesmo sem Ollama. Nesse modo,
> ele consulta a API diretamente (sem linguagem natural).

---

## Passo 11 (Opcional): Rodar o MCP Server

Para conectar o MCP Server a outros clientes MCP (Claude Desktop, Cursor, etc):

```bash
uv run python -m mcp-server.server
```

O servidor MCP roda via stdio e pode ser configurado em qualquer cliente
compativel com o Model Context Protocol.

---

## Comandos do Dia a Dia

| O que fazer | Comando |
|-------------|---------|
| Iniciar backend | `uv run uvicorn backend.app:app --reload --port 8000` |
| Iniciar frontend | `cd frontend && npm run dev` |
| Rodar testes | `uv run pytest tests/ -v` |
| Lint Python | `uv run ruff check .` |
| Formatar Python | `uv run ruff format .` |
| Build frontend | `cd frontend && npm run build` |
| Gerar dados sample | `uv run python -c "from importlib import import_module; import_module('data-pipeline.run').main()"` |
| Abrir notebook | `cd notebooks && uv run jupyter notebook` |
| Iniciar Ollama | `ollama serve` |

---

## Estrutura do Projeto

```
tcc-pipeline-transito-sus/
├── .env.example          # Template de variaveis de ambiente
├── .env                  # Suas variaveis (gitignored)
├── pyproject.toml        # Deps Python + config ruff/pytest
├── uv.lock               # Lock file Python
├── SETUP.md              # Este guia
├── FINANCEIRO.md         # Documentacao dos calculos financeiros
├── ARCHITECTURE.md       # Arquitetura e referencias tecnicas
├── README.md             # Visao geral do projeto
│
├── data-pipeline/        # ETL: Medallion (Bronze→Silver→Gold)
│   ├── config.py         # Pydantic Settings (.env)
│   ├── logging.py        # structlog configurado
│   ├── sample_data.py    # Gerador de dados amostrais
│   ├── datasus.py        # Download real via PySUS
│   ├── bronze.py         # Ingestao bruta → Parquet
│   ├── silver.py         # Filtro CID V01-V89 + enriquecimento
│   ├── gold.py           # Agregacoes por municipio/mes
│   ├── ibge.py           # Populacao IBGE + taxas relativas
│   └── run.py            # Orquestrador CLI
│
├── backend/              # FastAPI REST API
│   ├── app.py            # Aplicacao principal
│   ├── config.py         # Configuracao
│   ├── database.py       # Conexao DuckDB
│   ├── schemas.py        # Modelos Pydantic
│   └── routers/
│       ├── dashboard.py  # Endpoints do painel
│       ├── indicadores.py # Taxas relativas IBGE
│       └── mcp_bridge.py # Bridge HTTP para tools MCP
│
├── frontend/             # Next.js 16 + Tailwind
│   ├── src/app/
│   │   ├── dashboard/    # Painel geral
│   │   ├── municipio/    # Visao por cidade
│   │   ├── mapa/         # Mapa Leaflet
│   │   └── chat/         # Chat IA
│   └── src/components/
│       ├── layout/       # Sidebar + AppShell
│       ├── filters/      # FilterBar reutilizavel
│       ├── charts/       # KpiCard, ChartCard
│       └── map/          # MapView, MapLegend
│
├── mcp-server/           # MCP Server (FastMCP)
│   └── server.py         # 5 tools SQL
│
├── notebooks/            # EDA Jupyter
│   └── 01_eda_transito_sus.ipynb
│
├── tests/                # pytest
│   ├── test_api.py       # 14 testes API
│   ├── test_pipeline.py  # 9 testes pipeline
│   └── test_stack.py     # 4 testes stack
│
└── data/                 # Dados Parquet (gitignored)
    ├── bronze/
    ├── silver/
    └── gold/
```

---

## Solucao de Problemas

### "cffi failed to build"
Instale headers de desenvolvimento:
```bash
# Ubuntu/Debian
sudo apt install python3-dev libffi-dev

# macOS
xcode-select --install

# Windows
# Instale Visual Studio Build Tools
```

### "Port 8000 already in use"
Outro processo esta usando a porta:
```bash
# Linux/macOS
lsof -i :8000
kill <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### "FTP DATASUS timeout"
O FTP do DATASUS pode ser instavel. Tente:
1. Executar em horario comercial (menor carga)
2. Reduzir o escopo (1 UF por vez)
3. Usar dados amostrais para desenvolvimento

### "Ollama nao conecta"
1. Verifique se `ollama serve` esta rodando
2. Teste: `curl http://localhost:11434/api/tags`
3. Verifique se o modelo foi baixado: `ollama list`

### Frontend nao carrega dados
1. Verifique se o backend esta rodando na porta 8000
2. Verifique se os dados foram gerados (`ls data/gold/`)
3. Verifique CORS no `.env` (deve incluir `http://localhost:3000`)