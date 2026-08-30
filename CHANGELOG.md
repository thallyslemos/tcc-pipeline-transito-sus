# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[Conventional Commits](https://www.conventionalcommits.org/pt-br/); versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).
## [Nao lancado]

## [1.0.0] - 2026-08-30

### Adicionado
- Pagina Sobre o projeto (`/sobre`) com diagrama de fluxo e metadados SIM
- Filtros de recorte persistentes entre paginas (URL + sessionStorage)
- `ThemedTooltip` unificado e token `--chart-cursor` nos graficos
- Filtro por municipio na pagina Preliminares (backend + frontend)
- `docker-compose.prod.yml` para VPS com DuckDB embedded (Parquet read-only)
- Runtime config da API no frontend (`/runtime-config`, `API_URL` em Docker)
- Script `scripts/list_deploy_artifacts.py` e guia `docs/DEPLOY_ARTEFATOS.md`
- Endpoints temporais SIM (serie-mensal, dia-semana, outliers)
- Dockerfiles multi-stage para API e frontend; workflow release GHCR
- Protocolo de evidencia Bahia (frota e fluxos)

### Corrigido
- Hover dos graficos Recharts alinhado ao tema claro/escuro
- Comparacao preliminar vs consolidado por municipio (nao agregado UF)
- Arcos 3D deck.gl no mapa de fluxos
- Build Docker: `.dockerignore` permite `docs/metadata` na imagem API

### Documentacao
- `docs/DEPLOY_VPS.md` reescrito para deploy v1.0 DuckDB passo a passo
- Entrada TimesFM vs consolidado em `docs/BACKLOG_TAREFAS.md`

### Manutencao
- Removidos artefatos de debug (`debug_sobre.spec.ts`, benchmark temporario)
- `outputs/` adicionado ao `.gitignore`

## [0.2.0-sim-evidence] - 2026-08-06

### Adicionado
- Add FastAPI backend with DuckDB and stack smoke tests
- Add foundation and Medallion data pipeline
- Rebuild FastAPI backend with routers, DuckDB views, CORS
- Add Next.js dashboard with data storytelling
- Add comprehensive tests and fix lint issues
- Add EDA notebook and update AGENTS.md
- Redesign frontend with sidebar, map, city pages, filters
- Add IBGE demographics, relative indicators, MCP server
- Real PySUS pipeline, chat UI, financial documentation
- Implmenta integrção com base de dados geograficas do IBGE
- Integrar chat com MCP via Ollama tool calling + otimizar pipeline streaming
- Redesign UI com dual theme, KPIs narrativos e hierarquia semântica de cores
- Iteração 2.1 + 2.2 — GeoJSON endpoint, MapLibre GL JS, testes test-first
- Mapa coroplético com polígonos IBGE v4 + toggle Polígonos/Círculos
- Ajusta backend e atualiza docs
- Adiciona suporte a filtros geográficos e dimensão nos endpoints de município e ranking
- Implementa suporte a PostgreSQL com configuração, carga de dados e expressões SQL portáveis
- Adiciona suporte ao modo SIM-only no pipeline, permitindo geração de dados Gold sem SIA
- Segrega fetchers externos do pipeline SUS e implementa deduplicação de chamadas para população
- Integra novas expressões e joins com IBGE para métricas de custos e óbitos, aprimorando a visualização de dados no mapa
- Adiciona geração da camada Gold de frota municipal e integra novos endpoints para indicadores e série diária, incluindo suporte a dimensões e filtros
- Make streaming ingestion deterministic
- Add audited silver v2 contract
- Reconciliar metodologia do ONSV
- Materializar contrato nacional de evidencia
- Expose SIM-only evidence contract
- Align interface with SIM-only contract
- Métricas globais no painel SIM
- Explorador de fluxos residência↔ocorrência
- Pipeline ETL auditado de frota municipal
- Expor API REST de frota municipal validada
- Taxas veiculares com frota SENATRAN pareada por ano
- Habilitar taxa veicular no mapa, municipio e ranking


### Corrigido
- Corrigir nome da funcao ETL no AGENTS.md (run -> main)
- Corrigir DTOBITO DDMMYYYY + restaurar MCP/Chat + adicionar TimesFM + atualizar README
- Corrigir silver.py para dados reais DATASUS (todas colunas VARCHAR)
- SIA PA_DATREF não existe nos dados 2024 — usar PA_CMP com detecção automática
- Silver compatível com schema real DATASUS (trailing spaces, PA_MUNPCN, PA_FLIDADE)
- Ibge_fetcher compatível com códigos de 6 dígitos do DATASUS
- Mapa sem dados + dashboard top 10 municípios
- Ibge.py ParserException + gold.py JOIN 6↔7 dígitos + verificação silver
- Ibge.py ParserException + gold.py JOIN 6↔7 dígitos + verificação silver
- Lat/lon via API v4 metadados + parse localidades + forecaster 6 dígitos
- Aplicar correções do PR review (Copilot + Cursor Bugbot)
- Tooltips dark theme, donut legends, município N/D, filtro anos previsão
- Custo per capita vazio + pipeline modular (--ibge, --malhas, --gold)
- Corrige duplicação de municipios - verificar bug causador na base
- Corrige perda de dados no SIM
- Lint auto-format + cleanup (ruff + manual fixes)
- Corrige filtro por municipio de ocorrencia
- Correct legacy silver domains
- Forward SIM geographic filters
- Use backend geo endpoint in map
- Apply vehicle filter and preserve empty polygons
- Expose vehicle-aware map contract


### Documentacao
- Adiciona docuemntação inicial do projeto
- Move documentos para diretório próprio
- Adiciona documento de configuração/execução
- Adiciona README
- Enriquecer súmula TCC com referências acadêmicas e institucionais reais
- Atualizar AGENTS.md com caveats completos e plano de UI
- Reescrever notebook EDA com instruções de ambiente e consultas interativas
- Registrar backlog da próxima iteração no AGENTS.md
- Plano detalhado de iterações 2.1-2.6 (test-first + Docker)
- Atualizar súmula com 4 novas referências + revisar toda documentação
- Add Cloud environment caveats to AGENTS.md
- Documenta ultimas iterações
- Adiciona registros de alterações críticas a serem feitas
- Atualiza docs e planejamentos
- Adiciona demostração da interface
- Atualiza AGENTS.md e adiciona nova documentação sobre arquitetura e modelagem de dados
- Add specs
- Add canonical BA audit manifest
- Add versioned official reconciliation
- Formalize evidence and dimension contracts
- Define SIM-only operating scope
- Specify map and residence flow contracts
- Atualizar catalogo SENATRAN e contratos de frota


### Manutencao
- Initialize Python project with uv and core dependencies
- Add notebook lint ignores to pyproject.toml
- Update AGENTS.md with map/filter caveats
- Next-env.d.ts update from build
- Adiciona amostra dedados brutos
- Samples filtrados
- Atualiza notebook com outputs reais e adiciona dados populacionais


### Outros
- Development environment setup (#2)

* chore: initialize Python project with uv and core dependencies

- Add pyproject.toml with PySUS, DuckDB, FastAPI, FastMCP, pandas, pyarrow
- Add dev dependencies: ruff, pytest, pytest-asyncio
- Configure ruff linter and pytest settings
- Add AGENTS.md with Cursor Cloud development instructions

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: add FastAPI backend with DuckDB and stack smoke tests

- backend/app.py: minimal FastAPI app with DuckDB in-memory, sample data
  for traffic accident deaths, and 3 endpoints (/, /obitos, /obitos/total)
- tests/test_stack.py: smoke tests for DuckDB, Parquet roundtrip, PyArrow

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: add foundation and Medallion data pipeline

- Pydantic Settings for centralized config (.env / .env.example)
- Structured logging with structlog (color dev, JSON prod)
- Sample data generator with realistic distributions
- Bronze → Silver → Gold ETL pipeline with DuckDB + Parquet
- SIM: 3881 mortality records, SIA: 30991 ambulatory records
- Gold: 2762 death aggregations, 6387 cost aggregations
- 3 municipalities: São Paulo, BH, Vitória da Conquista (2019-2023)

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: rebuild FastAPI backend with routers, DuckDB views, CORS

- Proper app structure: config, database, schemas, routers
- Dashboard summary endpoint with 14 aggregation queries
- Municipality detail endpoint with time series
- CORS configured via .env for frontend integration
- Structured logging with structlog
- Health check endpoint

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: add Next.js dashboard with data storytelling

- Modern responsive UI with Tailwind CSS
- KPI cards: óbitos, custos, atendimentos, municípios
- Area charts: evolução temporal mensal (óbitos + custos)
- Pie chart: distribuição por tipo de veículo
- Bar charts: faixa etária, município, evolução anual
- Year filter with dynamic data refresh
- Storytelling intro banner and key findings section
- TypeScript strict mode, all types resolved

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: add comprehensive tests and fix lint issues

- test_pipeline.py: 9 tests covering Bronze→Silver→Gold pipeline
- test_api.py: 6 tests covering all API endpoints + CORS
- All 19 tests passing
- Fix ruff lint: imports sorted, unused removed, en-dashes replaced
- Update pyproject.toml with S104 ignore for dev server binding

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: add EDA notebook and update AGENTS.md

- Comprehensive EDA notebook with 9 sections:
  Bronze/Silver/Gold schema validation, temporal analysis,
  vehicle type distribution, municipal comparison, demographics,
  seasonality, and MCP query examples
- All cells execute successfully with validated output
- Update AGENTS.md with full service reference and caveats

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* chore: add notebook lint ignores to pyproject.toml

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* feat: redesign frontend with sidebar, map, city pages, filters

Major UI overhaul:
- AppShell with collapsible sidebar navigation (Dashboard, Municipios, Mapa)
- Reusable FilterBar component (ano, municipio, tipo_veiculo)
- Dashboard page with full filter support
- Municipality detail page with city cards and drill-down
- Map page with Leaflet heatmap (circle markers sized/colored by value)
- MapLegend component with color gradient scale
- Ranking table below map

Backend enhancements:
- /api/dashboard/mapa endpoint (obitos/custos by municipality with coords)
- /api/dashboard/municipios endpoint (list all with lat/lon)
- /api/dashboard/tipos-veiculo endpoint
- Enhanced summary with municipio + tipo_veiculo filters

Data expansion:
- 9 municipalities across 3 states (SP, MG, BA) with coordinates
- 4290 mortality records, 40898 ambulatory records
- All 24 tests passing

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

* chore: update AGENTS.md with map/filter caveats

Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>

---------

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Thallys <thallyslemos@users.noreply.github.com>
- Merge cursor/development-environment-setup-df58: POC inicial completa

- Backend: routers indicadores e mcp_bridge
- Data-pipeline: gold flexivel (sample + DATASUS), run com CLI --real
- Frontend: Chat IA, municipio com indicadores relativos
- Fix: filtro ano usa 'is not None' (evita bug com ano=0)
- Testes: cobertura dashboard + indicadores

Made-with: Cursor
- Corrige eros de lint apontados pelo ruff
- Merge pull request #3 from thallyslemos:feature/ibge-data-fetcher

Feature/ibge-data-fetcher
- Merge pull request #4 from thallyslemos/cursor/development-environment-setup-7943

Development environment setup
- Merge pull request #5 from thallyslemos/cursor/development-environment-setup-7943

fix: corrigir DTOBITO DDMMYYYY + restaurar MCP/Chat + adicionar Times…
- Merge pull request #6 from thallyslemos/cursor/development-environment-setup-7943

fix: corrigir silver.py para dados reais DATASUS (todas colunas VARCHAR)
- Merge pull request #7 from thallyslemos/cursor/development-environment-setup-7943

Cursor/development environment setup 7943
- Merge pull request #8 from thallyslemos/cursor/development-environment-setup-7943

docs: plano detalhado de iterações 2.1-2.6 (test-first + Docker)
- Merge pull request #9 from thallyslemos/cursor/development-environment-setup-7943

docs: atualizar súmula com 4 novas referências + revisar toda documen…
- Merge pull request #10 from thallyslemos/cursor/development-environment-setup-5914

melhorias de ui
- Ajustes de ui
- Testes e ajustes
- Merge pull request #11 from thallyslemos/cursor/development-environment-setup-5914

Cursor/development environment setup 5914
- Document silver quality blockers
- Add PySUS and ETL idempotency radar


### Performance
- Usar cache PySUS + DuckDB streaming (eliminar pandas do bronze)


### Testes
- Cover SIM navigation flow
- Align sidebar labels with sim-only navigation
- Cover map geo loading

