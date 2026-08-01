# AGENTS.md — Guia para Agentes IA

> **Documento para agentes de IA e desenvolvedores.**  
> Este guia contém todas as informações essenciais para entender, desenvolver e manter o projeto.

---

## 1. Visão Geral do Projeto

**Pipeline Analítico de Acidentes de Trânsito no SUS** é um sistema de apoio à decisão que analisa o impacto econômico e as macrotendências de acidentes de trânsito nos dados públicos do Sistema Único de Saúde (SUS) do Brasil.

### O que o projeto faz

1. **Extrai** microdados de mortalidade do SIM via PySUS; fontes SIA permanecem fora do escopo ativo
2. **Transforma** em arquitetura Medallion (Bronze → Silver → Gold) com DuckDB + Parquet
3. **Enriquece** com dados demográficos do IBGE (localidades, coordenadas, população)
4. **Expõe** via API REST (FastAPI) para dashboards, mapas e indicadores relativos
5. **Prediz** tendências de 12 meses com o modelo TimesFM (Google Research)
6. **Conversa** sobre os dados via chat com Ollama + MCP tools (linguagem natural → SQL)

### Fontes de dados

| Base | Sistema | Órgão | Campos principais |
|------|---------|-------|-------------------|
| **SIM** | Sistema de Informações sobre Mortalidade | DATASUS/SVS | `CAUSABAS` (CID-10), `DTOBITO`, `CODMUNOCOR`, `SEXO`, `IDADE` |
| **SIA/PA** | Sistema de Informações Ambulatoriais | DATASUS | `PA_CIDPRI` (CID-10), `PA_VALAPR`, `PA_QTDAPR`, `PA_MUNPCN` |
| **IBGE** | Tabela 6579 SIDRA + API Localidades | IBGE | População estimada, nome, UF, lat/lon |

**Filtro CID-10**: Capítulo XX — Acidentes de Transporte Terrestre, códigos **V01 a V89**.

---

## 2. Arquitetura e Stack Tecnológica

### Arquitetura Medallion

```
┌─────────────────────────────────────────────────────────────────┐
│                        FONTE DE DADOS                          │
│  DATASUS (SIM)              IBGE (SIDRA/Localidades)           │
└──────────┬────────────────────────────┬────────────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐
│      BRONZE         │      │        IBGE         │
│  Dados brutos em    │      │  Parquet de         │
│  Parquet (particionados      │  municípios e       │
│  por UF/ano)        │      │  população          │
└──────────┬──────────┘      └──────────┬──────────┘
           │                            │
           ▼                            │
┌─────────────────────┐                 │
│      SILVER         │                 │
│  Dados filtrados    │                 │
│  (CID V01-V89),     │                 │
│  tipos corrigidos   │                 │
└──────────┬──────────┘                 │
           │                            │
           ▼                            ▼
┌─────────────────────────────────────────────────────┐
│                      GOLD                           │
│  Tabelas agregadas por município/mês:               │
│  • obitos_ocorrencia_municipio_mes.parquet          │
│  • obitos_residencia_municipio_mes.parquet          │
│  • custos_municipio_mes.parquet                     │
│  • eventos_diarios_municipio.parquet                │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌──────────┐      ┌──────────────┐      ┌─────────────┐
│ FastAPI  │      │ MCP Server   │      │  Next.js    │
│ (Porta   │      │ (stdio/      │      │  (Porta     │
│  8000)   │      │  FastMCP)    │      │   3000)     │
└──────────┘      └──────────────┘      └─────────────┘
```

### Stack Tecnológica

| Camada | Tecnologia | Versão/Notas |
|--------|------------|--------------|
| Linguagem | Python | 3.12+ |
| Gerenciador de pacotes | uv | Astral (substitui pip/venv) |
| Extração | PySUS | DATASUS FTP → Parquet |
| Processamento | DuckDB | 1.0+ (OLAP in-process) |
| Armazenamento | Apache Parquet | Colunar, eficiente |
| Backend | FastAPI | 0.115+ |
| Configuração | Pydantic Settings | `.env` compartilhado |
| Logging | structlog | JSON em produção |
| IA Preditiva | TimesFM | Google Research, 200M params |
| IA Conversacional | FastMCP + Ollama | Modelo Qwen2.5:3b |
| Frontend | Next.js 16 | React + TypeScript |
| UI | Tailwind CSS | Estilos utilitários |
| Gráficos | Recharts | Visualizações |
| Mapas | MapLibre GL JS | Mapas interativos |
| Testes Python | pytest | 35+ testes |
| Testes Frontend | Vitest + React Testing Library |
| Lint/Format | ruff | PEP8 + imports + security |

---

## 3. Estrutura de Diretórios

```
tcc-pipeline-transito-sus/
├── .env.example              # Template de variáveis de ambiente
├── .env                      # Variáveis locais (gitignored)
├── pyproject.toml            # Deps Python + config ruff/pytest
├── uv.lock                   # Lock file Python
├── README.md                 # Visão geral do projeto
├── AGENTS.md                 # Este documento
│
├── docs/                     # Documentação completa
│   ├── SETUP.md              # Guia de configuração local
│   ├── ARCHITECTURE.md       # Arquitetura técnica detalhada
│   ├── BACKLOG_TAREFAS.md    # Tarefas e iterações
│   ├── GUIA_AGENTES.md       # Metodologia TDD
│   ├── FINANCEIRO.md         # Metodologia de cálculos
│   └── DADOS_MUNICIPIO.md    # Semântica de municípios
│
├── data-pipeline/            # ETL: Medallion (Bronze→Silver→Gold)
│   ├── config.py             # Pydantic Settings (.env)
│   ├── logging.py            # structlog configurado
│   ├── sample_data.py        # Gerador de dados amostrais
│   ├── datasus.py            # Download real via PySUS
│   ├── bronze.py             # Ingestão bruta → Parquet
│   ├── silver.py             # Filtro CID V01-V89 + limpeza
│   ├── gold.py               # Agregações por município/mês
│   ├── gold_timeseries.py    # Série temporal diária
│   ├── ibge.py               # Funções auxiliares IBGE
│   ├── ibge_fetcher.py       # Download dados IBGE
│   └── run.py                # Orquestrador CLI
│
├── backend/                  # FastAPI REST API
│   ├── app.py                # Aplicação principal
│   ├── config.py             # Configuração FastAPI
│   ├── database.py           # Conexão DuckDB singleton
│   ├── schemas.py            # Modelos Pydantic
│   ├── ibge.py               # Integração IBGE
│   ├── routers/
│   │   ├── dashboard.py      # Endpoints do painel
│   │   ├── geo.py            # Endpoints geográficos
│   │   ├── indicadores.py    # Taxas relativas IBGE
│   │   ├── predict.py        # Previsões TimesFM
│   │   ├── mcp_bridge.py     # Bridge HTTP para MCP
│   │   └── utils.py          # Funções auxiliares (filtros)
│   └── services/
│       └── forecaster.py     # Serviço de previsão
│
├── frontend/                 # Next.js 16 + Tailwind
│   ├── package.json          # Deps Node.js
│   ├── src/app/
│   │   ├── dashboard/        # Painel geral
│   │   ├── municipio/        # Visão por cidade
│   │   ├── mapa/             # Mapa Leaflet
│   │   ├── previsao/         # Previsões IA
│   │   └── chat/             # Chat IA
│   └── src/components/       # Componentes React
│
├── mcp-server/               # MCP Server (FastMCP)
│   └── server.py             # 6 tools SQL
│
├── notebooks/                # EDA Jupyter
│   └── 01_eda_transito_sus.ipynb
│
├── tests/                    # pytest
│   ├── conftest.py           # Fixtures compartilhadas
│   ├── test_api.py           # Testes da API
│   ├── test_pipeline.py      # Testes do pipeline
│   ├── test_stack.py         # Testes de stack
│   └── test_silver_real_data.py  # Validação dados reais
│
└── data/                     # Dados Parquet (gitignored)
    ├── bronze/
    ├── silver/
    └── gold/
```

---

## 4. Configuração do Ambiente

### Requisitos

- Python 3.12+
- Node.js 18+ (recomendado 22+)
- uv (gerenciador de pacotes Python)
- Git

### Instalação Rápida

```bash
# 1. Clonar o repositório
git clone https://github.com/thallyslemos/tcc-pipeline-transito-sus.git
cd tcc-pipeline-transito-sus

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Instalar dependências Python
uv sync

# 4. Instalar dependências do frontend
cd frontend && npm install && cd ..
```

### Variáveis de Ambiente (.env)

```bash
# Ambiente: development | staging | production
APP_ENV=development

# Nível de log: DEBUG | INFO | WARNING | ERROR
LOG_LEVEL=INFO

# Backend FastAPI
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=true

# Diretórios de dados (Medallion)
DATA_DIR=data
BRONZE_DIR=data/bronze
SILVER_DIR=data/silver
GOLD_DIR=data/gold

# CORS (origens permitidas)
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 5. Comandos Essenciais

### Desenvolvimento

| Ação | Comando |
|------|---------|
| Instalar dependências Python | `uv sync` |
| Instalar dependências Frontend | `cd frontend && npm install` |
| **Executar TODOS os Testes** | `uv run pytest tests/ -v` |
| **Verificar Qualidade** | `uv run ruff check .` |
| **Formatar Código** | `uv run ruff format .` |
| Iniciar Backend | `uv run uvicorn backend.app:app --reload --port 8000` |
| Iniciar Frontend | `cd frontend && npm run dev` |
| Testes Frontend | `cd frontend && npm test` |

### Pipeline de Dados

| Ação | Comando |
|------|---------|
| Dados amostrais (offline, ~2s) | `uv run python -m data-pipeline.run` |
| Dados reais do DATASUS (SIM) | `uv run python -m data-pipeline.run --real --ufs BA --anos 2024` |
| Apenas IBGE | `uv run python -m data-pipeline.run --ibge` |
| Auditar/materializar SIM v2 | `uv run python -m data-pipeline.run --sim-evidence --silver-v2 ...` |
| Apenas malhas GeoJSON | `uv run python -m data-pipeline.run --malhas` |
| Apenas Gold (requer Silver) | `uv run python -m data-pipeline.run --gold` |
| Carga PostgreSQL (requer `DATABASE_URL` + migrações) | `uv run python -m data-pipeline.run --load-postgres` |
| Migrações SQL | `uv run python db/run_migrations.py` |
| Limpar dados | `rm -rf data/bronze/* data/silver/* data/gold/*` |

### Serviços

| Serviço | Porta | Comando |
|---------|-------|---------|
| Backend (FastAPI) | 8000 | `uv run uvicorn backend.app:app --reload --port 8000` |
| Frontend (Next.js) | 3000 | `cd frontend && npm run dev` |
| MCP Server | stdio | `uv run python -m mcp-server.server` |
| Ollama (opcional) | 11434 | `ollama serve` |

---

## 6. Metodologia de Desenvolvimento: TDD

Este projeto segue **Test-Driven Development (TDD)**. O ciclo é:

### Ciclo RED-GREEN-REFACTOR

1. **(RED) Escrever teste que falha**: Antes de implementar, crie um teste que valide o comportamento desejado
2. **(GREEN) Implementar código mínimo**: Faça o teste passar com a implementação mais simples possível
3. **(REFACTOR) Refatorar**: Melhore a estrutura mantendo os testes passando

### Checklist de Qualidade

Antes de considerar uma tarefa "pronta":

- [ ] Todos os testes passam: `uv run pytest tests/ -v`
- [ ] Lint limpo: `uv run ruff check .`
- [ ] Código formatado: `uv run ruff format .`
- [ ] Testes de frontend passam (se aplicável): `cd frontend && npm test`

### Contratos, API e OpenSpec

Mudanças que afetem o **contrato da API REST** (paths, parâmetros, formato JSON)
ou o **schema de consumo** do dashboard ou do MCP exigem atualização de
[docs/SPEC.md](SPEC.md) e testes que cubram o comportamento novo. Se a mudança
afetar tabelas ou views servidas em produção, atualize também
[docs/MODELAGEM_DADOS.md](MODELAGEM_DADOS.md) e as migrações em `db/migrations/`.

Fluxo de especificação: [docs/OPENSPEC.md](OPENSPEC.md). PostgreSQL em produção:
[docs/adr/ADR-002_POSTGRES_SERVING.md](adr/ADR-002_POSTGRES_SERVING.md).

### Commits

Faça commits atômicos e claros:
```
feat(api): implementa filtro por regiao
fix(pipeline): corrige perda de dados no bronze
refactor(gold): simplifica agregacao de custos
docs: atualiza guia de setup
```

---

## 7. Padrões de Código

### Python

- **PEP 8** via ruff (line-length: 100)
- **Type hints** obrigatórios em funções públicas
- **Docstrings** em módulos e funções principais
- **Logging estruturado** com `structlog`

### Estrutura de Módulos

```python
"""Docstring do módulo explicando propósito."""

from pathlib import Path

import duckdb  # imports de terceiros
import pandas as pd

from .config import settings  # imports locais


def minha_funcao(param: str) -> int:
    """Docstring da função.
    
    Args:
        param: Descrição do parâmetro
        
    Returns:
        Descrição do retorno
    """
    return len(param)
```

### Ruff (pyproject.toml)

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
src = ["data-pipeline", "backend", "mcp-server", "tests"]

[tool.ruff.lint]
select = ["E", "F", "I", "W", "UP", "S", "B", "SIM", "RUF"]
ignore = ["S608", "S101", "S104"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "S106"]
"data-pipeline/sample_data.py" = ["S311"]
```

---

## 8. Modelo de Dados (Camada Gold)

### Tabelas Principais

| Tabela | Chave | Descrição |
|--------|-------|-----------|
| `obitos_ocorrencia_municipio_mes.parquet` | cod_mun_ibge + competência + dimensões | Óbitos por local de ocorrência |
| `obitos_residencia_municipio_mes.parquet` | cod_mun_ibge + competência + dimensões | Óbitos por local de residência |
| `custos_municipio_mes.parquet` | cod_mun_ibge + competência + dimensões | Custos ambulatoriais SIA |
| `eventos_diarios_municipio.parquet` | data + cod_mun_ibge | Série temporal diária |

### Colunas Comuns

```python
{
    "cod_mun_ibge": "string",      # Código IBGE do município
    "competencia": "date",          # Primeiro dia do mês
    "ano": "int",                   # Ano extraído
    "mes": "int",                   # Mês extraído
    "municipio": "string",          # Nome do município
    "uf": "string",                 # Sigla da UF
    "tipo_veiculo": "string",       # Motocicleta, Automóvel, etc
    "faixa_etaria": "string",       # 0-14, 15-24, etc
    "sexo": "string",               # M, F
    "lat": "double",                # Latitude
    "lon": "double",                # Longitude
    "populacao_estimada": "int",    # IBGE Tabela 6579
}
```

### Indicadores Relativos

| Indicador | Fórmula | Contexto |
|-----------|---------|----------|
| Taxa de Mortalidade | `(óbitos / população) * 100.000` | Por ocorrência ou residência |
| Custo per Capita | `custo_total / população` | Sempre por residência do paciente |

---

## 9. API Endpoints

### Dashboard

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/dashboard/summary` | KPIs gerais, séries temporais |
| `GET /api/dashboard/summary?ano=2023` | Summary filtrado por ano |
| `GET /api/dashboard/summary?uf=BA` | Summary filtrado por UF |
| `GET /api/dashboard/summary?municipio=2933307` | Summary por município |
| `GET /api/dashboard/summary?dimensao=residencia` | Análise por residência |
| `GET /api/dashboard/anos` | Anos disponíveis |
| `GET /api/dashboard/municipios` | Lista de municípios |
| `GET /api/dashboard/tipos-veiculo` | Tipos de veículo disponíveis |

### Indicadores

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/indicadores/taxa-mortalidade` | Taxa por 100 mil habitantes |
| `GET /api/indicadores/custo-per-capita` | Custo per capita por município |

### Mapas e Geográfico

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/geo/dados-mapa` | Dados para heatmap |
| `GET /api/geo/municipios-por-uf` | Municípios de uma UF |

### Previsões

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/predict/obitos` | Previsão de óbitos (TimesFM) |
| `POST /api/predict/custos` | Previsão de custos (TimesFM) |

### MCP Bridge

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/mcp/query` | Consulta via tools MCP |

---

## 10. MCP Server (Tools)

O MCP Server expõe 6 tools para LLMs consultarem os dados:

| Tool | Descrição |
|------|-----------|
| `listar_opcoes_filtro()` | Retorna anos, UFs, regiões, tipos de veículo disponíveis |
| `query_obitos(...)` | Consulta óbitos com filtros |
| `query_custos(...)` | Consulta custos ambulatoriais |
| `query_taxa_mortalidade(...)` | Calcula taxa por 100 mil habitantes |
| `query_serie_temporal(...)` | Retorna série temporal de um município |
| `listar_municipios(...)` | Lista municípios com totais |

### Uso

```bash
# Iniciar servidor MCP (stdio)
uv run python -m mcp-server.server

# Ou via backend bridge
POST /api/mcp/query
{
  "tool": "query_obitos",
  "params": {"uf": "BA", "ano": 2023}
}
```

---

## 11. Testes

### Estrutura de Testes

```
tests/
├── conftest.py              # Fixtures compartilhadas
├── test_api.py              # 14 testes da API
├── test_pipeline.py         # 9 testes do pipeline
├── test_stack.py            # 4 smoke tests (DuckDB, Parquet)
└── test_silver_real_data.py # Validação com dados reais
```

### Fixtures Principais (conftest.py)

| Fixture | Escopo | Descrição |
|---------|--------|-----------|
| `client` | session | TestClient do FastAPI |
| `ano_disponivel` | session | Primeiro ano nos dados |
| `municipio_disponivel` | session | Primeiro município nos dados |

### Executar Testes

```bash
# Todos os testes
uv run pytest tests/ -v

# Com cobertura
uv run pytest tests/ -v --cov=backend --cov=data-pipeline

# Teste específico
uv run pytest tests/test_api.py::test_health_check -v

# Testes do frontend
cd frontend && npm test
```

---

## 12. Lições Aprendidas (Caveats)

### Bug da Perda de Dados (Iteração 2)

- **Problema**: Perda de ~68% dos dados de óbitos
- **Causa**: Script `datasus.py` lia apenas o primeiro arquivo de múltiplos arquivos
- **Correção**: Pipeline agora limpa diretórios intermediários antes de executar
- **Lição**: Sempre valide contagens entre camadas (Bronze vs Silver vs Gold)

### Distinção Ocorrência vs Residência

- **Ocorrência**: Onde o óbito/acidente aconteceu (`CODMUNOCOR`)
- **Residência**: Onde a vítima residia (`CODMUNRES`)
- **Padrão**: Análises devem focar em **ocorrência**, mas oferecer opção de residência

### Valor Aprovado SIA (`PA_VALAPR`)

- **NÃO multiplicar** por `PA_QTDAPR`
- O campo já contém o valor total aprovado
- Referência: Tabela SIGTAP

### FTP DATASUS

- Pode ser lento ou instável
- Preferir execuções em horário comercial
- Para desenvolvimento, usar dados amostrais (`--sample`)

---

## 13. Documentação de Referência

| Documento | Descrição |
|-----------|-----------|
| [docs/SETUP.md](docs/SETUP.md) | Guia completo de configuração local |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura técnica e diagramas |
| [docs/BACKLOG_TAREFAS.md](docs/BACKLOG_TAREFAS.md) | Tarefas e iterações |
| [docs/GUIA_AGENTES.md](docs/GUIA_AGENTES.md) | Metodologia TDD detalhada |
| [docs/FINANCEIRO.md](docs/FINANCEIRO.md) | Metodologia de cálculos financeiros |
| [docs/DADOS_MUNICIPIO.md](docs/DADOS_MUNICIPIO.md) | Semântica de municípios |
| [docs/OPENSPEC.md](docs/OPENSPEC.md) | Fluxo spec → implementar → validar |
| [docs/MODELAGEM_DADOS.md](docs/MODELAGEM_DADOS.md) | Modelo lógico (Gold + Postgres) |
| [docs/DEPLOY_VPS.md](docs/DEPLOY_VPS.md) | Deploy com PostgreSQL na VPS |

---

## 14. Contato e Repositório

- **Autor**: Thallys Lemos
- **Instituição**: IFBA Campus Vitória da Conquista
- **Curso**: Bacharelado em Sistemas de Informação
- **Repositório**: https://github.com/thallyslemos/tcc-pipeline-transito-sus

---

*Última atualização: 2026-04-05*
