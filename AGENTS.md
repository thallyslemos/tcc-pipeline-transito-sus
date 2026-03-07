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
| Pipeline sample (offline) | `uv run python -m data-pipeline.run` |
| Pipeline real (requer FTP) | `uv run python -m data-pipeline.run --real --ufs BA --anos 2024` |
| Inspecionar schema PySUS | `uv run python scripts/inspect_pysus_schema.py` |
| Exportar samples filtrados | `uv run python scripts/export_test_sample.py` |
| Build frontend | `cd frontend && npx next build` |

### Configuracao

- Pydantic Settings carrega `.env` na raiz. Copie `.env.example` para `.env`.
- Frontend usa `.env.local` dentro de `frontend/`.
- Variaveis de ambiente documentadas em `.env.example`.

### Dados reais para teste

- `data/test_sample/sample_sim.parquet` (5000 registros SIM filtrados V01-V89)
- `data/test_sample/sample_sia.parquet` (4597 registros SIA filtrados V01-V89)
- Para testar pipeline sem PySUS: copiar samples para `data/bronze/sim_parts/` e `sia_parts/`
- Os samples são gerados por `scripts/export_test_sample.py` na máquina do usuário

### Caveats do pipeline

- **PySUS** tenta conectar ao FTP do DATASUS na importacao de `pysus.online_data.SIM`/`SIA`. Em sandbox, importe apenas `pysus` (nivel raiz) ou `pyreaddbc`.
- **PySUS cache**: Arquivos baixados ficam em `~/pysus/`. `download()` retorna do cache se existe (sem re-download).
- **Bronze streaming**: `baixar_sim_streaming()` / `baixar_sia_streaming()` usam DuckDB COPY (disco→disco, sem pandas em RAM). Bronze parts idempotentes (pula se já existem).
- **Campos VARCHAR**: Dados reais do PySUS vêm TODOS como VARCHAR com espaços. O Silver usa `TRIM(CAST(... AS VARCHAR))` + `TRY_CAST` em tudo.
- **DTOBITO (SIM)**: String `"DDMMYYYY"` nos dados reais. Silver: `TRY_STRPTIME('%d%m%Y')` com fallback `TRY_CAST(AS DATE)`.
- **IDADE (SIM)**: Código DATASUS 3 dígitos (`"498"`=98 anos, `"310"`=0 anos). Silver decodifica: 4xx→anos, 5xx→100+, ≥100→0, <100→direto.
- **PA_CODMUN não existe no SIA real**: O campo é `PA_MUNPCN`. Silver detecta automaticamente (`PA_MUNPCN` > `PA_CODMUN` > `PA_UFMUN`).
- **PA_DATREF não existe no SIA 2024**: O campo é `PA_CMP`. Silver detecta automaticamente (`PA_CMP` > `PA_DATREF` > `PA_MVM`).
- **Código município 6 vs 7 dígitos**: DATASUS usa 6 (sem dígito verificador), IBGE usa 7. Todos os JOINs usam `LEFT(x, 6) = LEFT(y, 6)`.
- **IBGE lat/lon**: API v4 metadados (`/api/v4/malhas/municipios/{cod}/metadados`) retorna centroide. A v3 malhas GeoJSON retorna 404.
- **IBGE Tabela 6579**: Sem dados para 2022 (ano do Censo) e 2023+ (pode não ter estimativas). Fallback: dicionário embutido em `data-pipeline/ibge.py`.
- **IBGE localidades**: Município "Boa Esperança do Norte" tem `microrregiao: null`. Parse faz fallback para `regiao-imediata`.

### Caveats do frontend

- **Previsão IA (TimesFM)**: Mínimo 12 meses de histórico. Queries usam `LEFT(cod_mun_ibge, 6)` para match 6↔7 dígitos.
- **Chat + MCP**: Ollama tool calling com 5 MCP tools via HTTP bridge (`/api/mcp/*`).
- Frontend usa Leaflet (client-only) com `dynamic import` + `ssr: false`.
- `FilterBar` é desacoplado: recebe `filters[]` como prop.

### Próxima fase — Backlog

#### Mapa
- [ ] Substituir Leaflet por **MapLibre GL JS** (3D pitch/bearing, camadas toggle)
- [ ] Adicionar camada de **polígonos GeoJSON** dos municípios (IBGE v4) com hover/popup (óbitos, custos, atendimentos)
- [ ] **Validar lat/lon**: alguns municípios aparecem fora dos limites estaduais — verificar se é erro no centroide da API IBGE ou código de município errado (6↔7 dígitos)
- [ ] Formatar valores no mapa: custos mostram "R$ 0.07M" para valores que são milhares, não milhões — usar formatação adaptativa (K/M)

#### Página Municípios
- [ ] **Taxa de mortalidade e custo per capita** aparecem vazios ("-") — provável que `ibge_populacao.parquet` não tem dados para os anos/municípios filtrados (IBGE Tabela 6579 sem 2022/2023). Verificar se o fallback para o dicionário embutido está funcionando no endpoint `/api/indicadores/municipio/{cod}`

#### Previsão IA
- [ ] **Intervalo de confiança** (P10-P90) renderiza em cor quase invisível — trocar para cor mais contrastante com opacidade maior no `ForecastChart.tsx`

#### Chat IA (MCP + Ollama)
- [ ] **Melhorar qualidade das respostas**: o modelo qwen2.5:3b tem dificuldade em interpretar os resultados das tools e gerar respostas úteis. Considerar: modelo maior (7b), system prompt mais detalhado, ou pós-processamento dos resultados das tools
- [ ] **Renderizar tabelas**: respostas do chat são só texto — implementar detecção de dados tabulares no resultado e renderizar como `<table>` HTML no frontend
- [ ] **Markdown rendering**: suportar formatação markdown (negrito, listas, tabelas) nas respostas do assistente

#### Design System
- [ ] Implementar **tema claro/escuro** com CSS variables + Tailwind v4
- [ ] Integrar **lucide-animated** para ícones animados no sidebar e KPIs
- [ ] Padronizar paleta de cores em um módulo compartilhado (mapa, gráficos, KPIs)
