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

### Próxima fase — Plano de Iterações

Metodologia: **test-first** — cada feature começa com teste unitário no backend antes da implementação. Ao final, Dockerizar a aplicação.

**Status**: ✅ = concluída | 🔧 = em progresso | ⬚ = não iniciada

#### Iteração 2.1 — Fixes de dados e backend (test-first) ✅

**Objetivo**: corrigir dados incorretos antes de mexer na UI.

1. **Fix lat/lon fora dos limites** ✅
   - Teste: `test_ibge_lat_lon_bounds` — coordenadas validadas nos limites do Brasil
   - GeoJSON endpoint filtra pontos fora dos bounds automaticamente (`backend/routers/geo.py`)
   - Pipeline (`ibge_fetcher.py`): não modificado — validação feita no backend/endpoint

2. **Fix taxa mortalidade / custo per capita vazios** ✅
   - Teste: `test_indicadores_municipio_populacao` — indicadores retornam valores
   - `backend/ibge.py` usa `LEFT(cod_mun_ibge, 6)` para match 6↔7 dígitos
   - **Nota**: IDH, PIB per capita e Área NÃO existem no parquet `ibge_municipios.parquet` (só no fallback hardcoded para 9 municípios). Frontend exibe "N/D" quando indisponível.

3. **Fix formatação de custos no mapa** ✅
   - MapView popup agora usa `formatCurrency()` / `formatNumber()` do `lib/format.ts`
   - Tooltips tema-aware com CSS vars

4. **Endpoint GeoJSON** ✅
   - Teste: `test_geojson_municipios` (8 testes em `tests/test_iter21.py`) — todos passam
   - `backend/routers/geo.py`: GET `/api/geo/municipios` retorna FeatureCollection válido
   - Pontos (centroides) com propriedades (valor, municipio, uf, atendimentos)
   - Filtra coordenadas fora dos limites do Brasil automaticamente
   - **Nota**: Não há polígonos/malhas — IBGE v3 retorna 404, v4 retorna metadados/SVG. Polígonos requerem download bulk de GeoJSON do IBGE (futuro).

#### Iteração 2.2 — MapLibre + Camadas ✅

**Objetivo**: substituir Leaflet por MapLibre GL JS.

1. ✅ `npm install maplibre-gl` + removido `leaflet`, `react-leaflet`, `@types/leaflet`
2. ✅ `MapView.tsx` reescrito com MapLibre:
   - Basemap: CARTO raster light/dark (tema-aware via `src.setTiles()`)
   - Circle layer para pontos (GeoJSON source)
   - Popup no hover com formatação correta (formatCurrency/formatNumber)
   - Controle de navegação (compass, zoom, pitch)
   - Suporte 3D: pitch e drag rotate habilitados
   - **Troca de tema sem perda de dados**: usa `setTiles()` em vez de `setStyle()` para preservar layers
3. ✅ `MapLegend.tsx` mantido com cores do tema
4. ⬚ Fill layer para polígonos (requer GeoJSON de malhas — futuro)
5. ⬚ Controle de camadas toggle circles/polígonos (depende de #4)

#### Iteração 2.3 — Design System (tema + ícones) ✅

**Objetivo**: tema claro/escuro + ícones animados.

1. ✅ `globals.css`: CSS custom properties para cores (light/dark) — ~40 tokens semânticos
2. ✅ `ThemeProvider` context com toggle + localStorage + prefers-color-scheme
3. ✅ AppShell/Sidebar: toggle sun/moon no rodapé do sidebar
4. ✅ `npm install lucide-react` — substituiu SVGs inline nos ícones do sidebar e KPIs
5. ✅ Paleta semântica: `--deaths` (vermelho), `--costs` (âmbar), `--health` (azul), `--success` (verde)
6. ✅ KPI Cards narrativos com sparklines Recharts
7. ✅ Donut charts com legendas externas (sem labels sobrepostos)
8. ✅ Tooltips tema-aware (`itemStyle`, `labelStyle` com `var(--fg)`)
9. ✅ Paginação na lista de municípios e tabela do mapa

#### Iteração 2.4 — Chat melhorado ⬚

**Objetivo**: respostas mais úteis com tabelas e markdown.

1. `npm install react-markdown` para renderizar markdown nas respostas
2. Melhorar system prompt do Ollama: instruir a formatar dados em tabelas markdown
3. Pós-processamento: detectar dados tabulares nos resultados das tools e converter para markdown table antes de enviar ao modelo
4. UI: renderizar `<ReactMarkdown>` em vez de `<pre>` nas mensagens do assistente

#### Iteração 2.5 — Previsão IA (ajuste visual + filtros) ✅

1. ✅ `ForecastChart.tsx`: cores do intervalo de confiança tema-aware (var(--deaths-glow) / var(--costs-glow))
2. ✅ Tooltip com formatação tema-aware
3. ✅ Card "Insight da IA" com ícone BrainCircuit e resumo textual
4. ✅ **Filtro de período histórico**: ano_inicio / ano_fim no backend (`forecaster.py`) e frontend
   - Permite excluir anos com subnotificação que afetam a média

**Nota sobre granularidade temporal**: Silver SIM mantém `dt_obito` (data completa, dia/mês/ano). Análise semanal é viável a partir do Silver, mas requer nova agregação no Gold ou query direta. Atualmente Gold agrega por mês (`competencia`).

#### Iteração 2.6 — Dockerização ⬚

**Objetivo**: `docker compose up` para rodar tudo localmente.

1. `Dockerfile.backend`: Python 3.12 + uv + deps
2. `Dockerfile.frontend`: Node 22 + npm + build
3. `docker-compose.yml`:
   - `backend`: porta 8000, volume `data/`
   - `frontend`: porta 3000, depende do backend
4. `.dockerignore`: node_modules, .venv, __pycache__, data/bronze, data/silver
5. Documentar no `docs/SETUP.md` e `README.md`

### Caveats do ambiente Cloud

- **Pipeline sample demora ~5min** por causa das chamadas HTTP ao IBGE (metadados + SIDRA para ~586 municípios). Se `data/ibge_municipios.parquet` e `data/ibge_populacao.parquet` já existem, gere Gold diretamente: `uv run python -c "from importlib import import_module; g = import_module('data-pipeline.gold'); g.gerar_gold_obitos(Path('data/silver/sim.parquet')); g.gerar_gold_custos(Path('data/silver/sia.parquet'))"` (substitua `Path` por `from pathlib import Path`).
- **`python -m data-pipeline.run`** não funciona com `python` direto porque `-m` não suporta hyphens. Use sempre `uv run python -c "from importlib import import_module; mod = import_module('data-pipeline.run'); mod.main()"` ou espere que o diretório seja renomeado.
- **Testes pré-existentes falhando**: 4 testes em `test_api.py` falham porque assertions estão hardcoded com `== 9` municípios, mas os dados sample geram 586. São falhas pré-existentes, não causadas pelo setup.
- **`uv` no PATH**: O update script instala `uv` em `~/.local/bin`. Se o shell não encontrar `uv`, execute `export PATH="$HOME/.local/bin:$PATH"`.

### Regras para próximas iterações

- **Test-first**: escrever teste antes da implementação
- **Não quebrar**: rodar `uv run pytest tests/ -v` após cada mudança
- **Commits atômicos**: um commit por feature/fix lógico
- **Samples reais**: usar `data/test_sample/` para testes end-to-end
- **Lint sempre**: `uv run ruff check .` deve passar (exceto o erro pré-existente em `backend/ibge.py`)
