## Pipeline Analítico de Acidentes de Trânsito no SUS

**TCC — Bacharelado em Sistemas de Informação, IFBA Campus Vitória da Conquista**

Impacto econômico e macrotendências de acidentes de trânsito no SUS, com Engenharia
de Dados (DuckDB), IA Preditiva (TimesFM) e interface conversacional (MCP + Ollama).

![Demo da interface do painel SUS](assets/ui-sus-pipeline.gif)

### O que este projeto faz

1. **Extrai** microdados de mortalidade (SIM) e custos ambulatoriais (SIA) do DATASUS via PySUS.
2. **Transforma** em arquitetura Medallion (Bronze → Silver → Gold) com DuckDB + Parquet.
3. **Enriquece** com dados demográficos do IBGE (localidades, coordenadas, população estimada via Tabela 6579 SIDRA).
4. **Expõe** via API REST (FastAPI) para dashboards, mapas e indicadores relativos (taxa de mortalidade por 100 mil hab, custo per capita).
5. **Prediz** tendências de 12 meses com o modelo de fundação TimesFM (Google Research).
6. **Conversa** sobre os dados via chat com Ollama + MCP tools (linguagem natural → SQL).

### Fontes de dados

| Base | Sistema | Órgão | Campos principais |
|------|---------|-------|-------------------|
| **SIM** | Sistema de Informações sobre Mortalidade | DATASUS/SVS | `CAUSABAS` (CID-10), `DTOBITO`, `CODMUNOCOR`, `SEXO`, `IDADE` |
| **SIA/PA** | Sistema de Informações Ambulatoriais — Produção Ambulatorial | DATASUS | `PA_CIDPRI` (CID-10), `PA_VALAPR` (valor aprovado R$), `PA_QTDAPR`, `PA_MUNPCN`, `PA_CMP` |
| **IBGE** | Tabela 6579 SIDRA + API Localidades + Malhas GeoJSON | IBGE | População estimada, nome, UF, lat/lon |

- **Filtro CID-10**: Capítulo XX — Acidentes de Transporte Terrestre, códigos **V01 a V89**.
- **DTOBITO** (SIM): Campo de data do óbito. Nos dados reais do DATASUS, vem como string `DDMMYYYY` (ex: `"11042024"`). O pipeline converte automaticamente para DATE via `TRY_STRPTIME`.
- **PA_CMP** (SIA 2024+): Competência no formato `YYYYMM` (ex: `"202401"`). Versões anteriores usam `PA_DATREF` — o pipeline detecta automaticamente.
- **PA_VALAPR** (SIA): Valor **total aprovado** para o registro — **NÃO multiplicar** por `PA_QTDAPR`. Referência: tabela SIGTAP.

---

Mudanças que alterem contrato da API ou schema de consumo devem seguir
[docs/OPENSPEC.md](docs/OPENSPEC.md) e atualizar [docs/SPEC.md](docs/SPEC.md).
Deploy em VPS com PostgreSQL: [docs/DEPLOY_VPS.md](docs/DEPLOY_VPS.md).

### Como rodar

Guia completo (instalação, ambiente, comandos): **[docs/SETUP.md](docs/SETUP.md)**

Resumo rápido:

```bash
uv sync                        # dependências Python
cd frontend && npm install     # dependências frontend
uv run python -m data-pipeline.run   # dados amostrais (offline, ~2s)
uv run uvicorn backend.app:app --reload --port 8000  # backend
cd frontend && npm run dev     # frontend em localhost:3000
```

Para dados reais do DATASUS (requer internet):

```bash
uv run python -m data-pipeline.run --real --ufs BA --anos 2024
```

### Serviços

| Serviço | Porta | Comando |
|---------|-------|---------|
| Backend (FastAPI) | 8000 | `uv run uvicorn backend.app:app --reload --port 8000` |
| Frontend (Next.js) | 3000 | `cd frontend && npm run dev` |
| MCP Server (FastMCP) | stdio | `uv run python -m mcp-server.server` |

### Páginas do frontend

| Rota | Descrição |
|------|-----------|
| `/dashboard` | Painel geral — KPIs, séries temporais, distribuições |
| `/municipio` | Visão por município — cards, detalhes |
| `/mapa` | Mapa de calor Leaflet com circle markers |
| `/previsao` | Previsão IA (TimesFM) — 12 meses com intervalo de confiança |
| `/chat` | Chat IA — Ollama com MCP tools para consulta em linguagem natural |

### Testes e qualidade

```bash
uv run pytest tests/ -v    # 35 testes (pipeline + API + stack + dados reais)
uv run ruff check .        # lint
uv run ruff format .       # formatação
```

---

### Documentação

| Documento | Descrição |
|-----------|-----------|
| **[docs/SETUP.md](docs/SETUP.md)** | Guia completo de configuração local (Windows/macOS/Linux), comandos do dia a dia, solução de problemas |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Arquitetura do pipeline (Medallion), modelo de dados Gold, integração IBGE, MCP Server, diagramas Mermaid |
| **[docs/FINANCEIRO.md](docs/FINANCEIRO.md)** | Metodologia de cálculos financeiros (SIA/PA), significado de `PA_VALAPR`, limitações conhecidas |
| **[docs/DADOS_MUNICIPIO.md](docs/DADOS_MUNICIPIO.md)** | Semântica município (ocorrência vs residência), correção UF (Fortaleza/Joinville), fontes |
| **[docs/BACKLOG_TAREFAS.md](docs/BACKLOG_TAREFAS.md)** | Tarefas priorizadas com critérios de aceite (2.7 UF, 2.8 GeoJSON, etc.) |
| **[docs/GUIA_AGENTES.md](docs/GUIA_AGENTES.md)** | Instruções para agentes IA, fluxo de trabalho, padrões e checklist |
| **[docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md)** | Plano de iterações, stack, referência CID-10, instruções por iteração |
| **[docs/Thallys \[TCC I\] Súmula](docs/Thallys%20%5BTCC%20I%5D%20Súmula%20de%20Projeto%20de%20Pesquisa.docx.md)** | Pré-projeto de pesquisa com 22 referências acadêmicas/institucionais (NBR 6023:2018) |
| **[AGENTS.md](AGENTS.md)** | Instruções para uso com agentes IA (Cursor/LLMs), comandos e caveats |

### Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Extração | PySUS (DATASUS FTP → Parquet) |
| Processamento | DuckDB (OLAP in-process) + Apache Parquet (Medallion) |
| Dados demográficos | IBGE API (Tabela 6579 SIDRA, Localidades, Malhas GeoJSON) |
| Backend | FastAPI + Pydantic Settings + structlog |
| IA Preditiva | TimesFM (Google Research, 200M params, CPU) |
| IA Conversacional | FastMCP (MCP Server) + Ollama (Qwen2.5, tool calling) |
| Frontend | Next.js 16, Tailwind CSS, Recharts, Leaflet |
| Testes | pytest (35 testes: pipeline + API + stack + dados reais) |
| Lint | ruff (PEP8 + imports + security) |
