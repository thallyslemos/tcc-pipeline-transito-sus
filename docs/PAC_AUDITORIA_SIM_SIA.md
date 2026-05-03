# Plano de Auditoria e Correção (PAC) — SIM/SIASUS

Role: Engenheiro de Dados Sênior e Auditor de BI em Saúde Pública e Dados de Trânsito Brasileiro.

Objetivo: auditar e corrigir o pipeline de acidentes de trânsito (SIM/SIA) para alinhar os resultados com as fontes oficiais (DATASUS, SIMU, ONSV) e separar corretamente os conceitos de **município de residência** e **município de ocorrência/atendimento**.

---

## 1. Premissa Ética e Técnica

1. **Compromisso com o rigor metodológico**
   - Indicadores de mortalidade e custo em saúde têm impacto direto em decisões de política pública; qualquer erro de agregação pode induzir gestores a conclusões equivocadas.
   - Todas as análises devem respeitar a estrutura oficial das bases, conforme:
     - `docs/Estrutura_do_SIM_2025.md` (campos do SIM).
     - `docs/Informe_Tecnico_SIASUS_2019_07.md` (layout PA/SIASUS).

2. **Validação cruzada obrigatória (Cross-Check)**
   - Antes de publicar ou usar qualquer número em apresentações, **comparar obrigatoriamente**:
     - Contagens anuais de óbitos (SIM, V01–V89) com:
       - Painel/painel técnico do **ONSV** ([dados consolidados DATASUS 2023](https://onsv.github.io/analise-datasus-2023/datasus2023.html)).
       - Painel **SIMU/Cidades** para taxa de mortalidade por acidentes de transporte.[^simu]
     - Taxas por 100 mil habitantes com a fórmula oficial do SIMU/IBGE.[^simu]
   - Divergências relevantes (ex.: 788 vs >2.000 óbitos em 2022) **devem ser documentadas** neste PAC e investigadas antes de qualquer divulgação.

3. **Transparência de premissas**
   - Toda escolha metodológica (ex.: usar CODMUNOCOR ou CODMUNRES; incluir/excluir certos CIDs) deve ser:
     - Especificada textualmente em `docs/DADOS_MUNICIPIO.md`.
     - Referenciada em `AGENTS.md` e `docs/BACKLOG_TAREFAS.md`.
     - Justificada com base em documentos oficiais (SIM, SIASUS, IBGE, SIMU, ONSV).

---

## 2. Auditoria da Modelagem Dimensional (Municípios)

### 2.1. Diferença técnica entre CODMUNRES e CODMUNOCOR — SIM

Conforme `docs/Estrutura_do_SIM_2025.md`:

- **CODMUNRES** — “Código do município de residência do falecido” (7 dígitos IBGE). Representa **onde a pessoa morava**.
- **CODMUNOCOR** — “Código relativo ao município onde ocorreu o óbito” (7–8 dígitos, dependendo do layout). Representa **onde o óbito ocorreu** (que, para acidentes, aproxima o local do sinistro/atendimento).

**Estado atual do pipeline:**

- Silver SIM (`data-pipeline/silver.py`):
  - Lê ambos os campos, mas só **`cod_mun_ocorrencia`** é usado no Gold; `cod_mun_residencia` é carregado e depois ignorado.
- Gold SIM (`data-pipeline/gold.py`):
  - Define `cod_mun_ibge = cod_mun_ocorrencia`.
  - Agrega obitos por `cod_mun_ocorrencia`, `municipio`, `uf`, `competencia`, `tipo_veiculo`, `faixa_etaria`, `sexo`.

**Risco:** estamos produzindo **apenas indicadores por município de ocorrência**, enquanto o ONSV agrega **por residência** e o SIMU/Ministério das Cidades explicita que utiliza óbitos por ocorrência para o indicador municipal.[^simu]

### 2.2. Campos de município no SIA/PA

Conforme `docs/Informe_Tecnico_SIASUS_2019_07.md`:

- **PA_UFMUN (pos. 4)** — “Unidade da Federação + Código do Município onde está localizado o estabelecimento” → município de **atendimento** (estabelecimento).
- **PA_MUNPCN** — (documentado em tabela de domínio externa) representa o **município de residência do paciente**.
- **PA_CODUNI** — código do estabelecimento no CNES (possível chave para cruzar com município via CNES).

**Estado atual do pipeline:**

- Silver SIA (`data-pipeline/silver.py`):
  - Detecta automaticamente a coluna de município em ordem: `PA_MUNPCN` > `PA_CODMUN` > `PA_UFMUN` e padroniza como `cod_mun`.
  - Não diferencia **residência** vs **local de atendimento**.
- Gold SIA (`data-pipeline/gold.py`):
  - Usa `cod_mun` como `cod_mun_ibge` sem distinguir se é município de residência ou estabelecimento.

### 2.3. Ação imediata: segregação conceitual

1. **Criar dimensões lógicas distintas** (mesmo que na prática sejam views no DuckDB):
   - `mun_residencia` — baseado em CODMUNRES (SIM) e PA_MUNPCN (SIA).
   - `mun_ocorrencia` — baseado em CODMUNOCOR (SIM).
   - `mun_atendimento` — baseado em PA_UFMUN/PA_CODUNI→CNES (SIA), se for adotado no futuro.
2. **Fatos separados ou métricas claramente rotuladas**:
   - `f_obitos_ocorrencia` — óbitos por CODMUNOCOR.
   - `f_obitos_residencia` — óbitos por CODMUNRES.
   - `f_custos_residencia` — custos SIA por PA_MUNPCN (modelo atual).
   - (Futuro) `f_custos_atendimento` — custos por PA_UFMUN/município do estabelecimento.
3. **No frontend e na API**, qualquer filtro “Município” deve ser associado explicitamente ao tipo de município (residência vs ocorrência vs atendimento), idealmente com rótulos claros.

---

## 3. Diagnóstico de Divergência (Benchmark Externo)

### 3.1. Cenário observado

- Dashboard interno (2022, sem filtro de município): **788 óbitos**.
- Estudo **ONSV/DATASUS 2023**: aponta valores superiores a 2.000 óbitos para 2022, considerando todo o Brasil.
- Painel **SIMU/Cidades**: taxa de mortalidade em acidentes de trânsito por 100 mil habitantes significativamente maior que a refletida em nosso dashboard.

### 3.2. Metodologias externas (resumo)

- **ONSV – Análise DATASUS 2023**[^onsv]:
  - Fonte: SIM/DATASUS, códigos CID-10 **V01–V89** (sinistros de trânsito).
  - Agregação por **município de residência** das vítimas.
  - Contagens anuais consolidadas para Brasil, UF e municípios.
- **SIMU/Cidades – Indicador de acidentes de transportes**[^simu]:
  - Fonte: SIM/DATASUS (óbitos) + IBGE (população).
  - Indicador: \( \text{mortes em acidentes de trânsito} / \text{população municipal} \times 100.000 \).
  - Usa **óbitos por ocorrência** (município onde ocorreu o óbito) no recorte municipal.

### 3.3. Hipóteses iniciais para subestimação (788 vs >2.000)

1. **Cobertura geográfica parcial**:
   - O pipeline pode ter sido executado apenas para um subconjunto de UFs (ex.: BA, SP, MG), enquanto o ONSV considera Brasil inteiro.
   - A UI do dashboard pode estar apresentando esses dados como “geral Brasil” sem deixar claro o escopo de UFs.

2. **Filtros CID-10 mais restritivos que V01–V89**:
   - Silver SIM filtra `LEFT(CAUSABAS, 3) BETWEEN 'V01' AND 'V89'` — correto em tese.
   - É preciso confirmar se **nenhum outro filtro** está excluindo óbitos (ex.: TIPOBITO, IDADE, problemas em DTOBITO).

3. **Perda de registros por problemas de data**:
   - Silver descarta registros com `_dt IS NULL` após `TRY_STRPTIME(DTOBITO, '%d%m%Y')`.
   - Qual a proporção de registros V01–V89 com DTOBITO inválido para 2022? Uma taxa alta poderia reduzir substancialmente o total.

4. **Erro de agregação no Gold/API**:
   - O Gold agrega por `cod_mun_ocorrencia`, `tipo_veiculo`, `faixa_etaria`, `sexo`. Se o endpoint somar incorretamente sobre múltiplas linhas, pode **sub** ou **supercontar**.
   - É preciso checar se os endpoints de `/api/dashboard/summary` e `/api/dashboard/mapa` usam `SUM(total_obitos)` corretamente e não aplicam filtros indevidos.

5. **Diferença de conceito de município (residência vs ocorrência)**:
   - ONSV agrega por **residência**; nosso dashboard principal usa **ocorrência**.
   - Mesmo assim, a ordem de grandeza (788 vs >2.000) sugere problemas adicionais (cobertura ou filtros).

### 3.4. Plano de comparação 2022 (nacional)

Para o ano **2022**, executar (em notebook dedicado):

1. **SIM bruto (via PySUS/~/pysus ou Bronze)**
   - Query A1 (todos os óbitos por acidentes de transporte):
     - Filtro: \(\text{CAUSABAS}\) entre V01 e V89; TIPOBITO != 1 (se desejar excluir fetais).
     - Sem filtro de UF — Brasil inteiro.
     - Contar total anual e totais por UF.
   - Query A2 (por residência vs ocorrência):
     - Contar total anual por CODMUNRES e por CODMUNOCOR.
     - Verificar se as ordens de grandeza se aproximam dos painéis SIMU/ONSV.

2. **Gold atual**
   - Query B1: contar `SUM(total_obitos)` para 2022, sem filtro de município.
   - Query B2: comparar B1 com A1 — diferença de proporção indica perda no ETL/agregação.

3. **Dashboards**
   - Reproduzir manualmente, via API, a chamada usada pelo frontend para 2022 e sem município.
   - Confirmar se o valor exibido (788) coincide com o valor de B1; se não, o problema está no consumo (UI ou endpoint).

4. **Cross-check externo**
   - Usar os painéis do ONSV e SIMU para obter o total nacional 2022 (mesmo critério de CIDs) e comparar com A1/B1.

---

## 4. Revisão do Pipeline de Ponta a Ponta

### 4.1. Ingestão — PySUS → Bronze

**Objetivo:** garantir que todos os registros relevantes entrem no pipeline.

1. **Mapear arquivos usados**
   - Listar todos os `.parquet` em `~/pysus` (ou diretório configurado):
     - SIM: arquivos iniciando por `DO` (CID10).
     - SIA: arquivos iniciando por `PA` (PAufaamm.dbf compactados).
   - Verificar se todos os anos/UFs esperados estão presentes para 2022.

2. **Verificar contagens pós-conversão Bronze**
   - Utilizar DuckDB para contar registros em `data/bronze/sim_parts/*.parquet` e `data/bronze/sia_parts/*.parquet` por ano/UF.
   - Comparar com as contagens originais dos Parquets do PySUS (usando `scripts/inspect_pysus_schema.py`).
   - Garantir que a função `_pysus_to_bronze_duckdb` não está descartando colunas ou linhas indesejadas.

### 4.2. Transformação — Bronze → Silver

**SIM (Silver)**

1. Verificar cláusula de filtro:
   - `WHERE LEFT(TRIM(CAST(CAUSABAS AS VARCHAR)), 3) BETWEEN 'V01' AND 'V89'`.
   - Conferir se há registros com CAUSABAS em minúsculo, espaços extras ou códigos equivalentes que possam estar sendo descartados.
2. Quantificar perdas por `DTOBITO` inválido:
   - Contar quantos registros V01–V89 têm DTOBITO inválido ou nulo e, portanto, são excluídos pelo `_dt IS NOT NULL`.
3. Documentar explicitamente se TIPOBITO fetal é incluído ou excluído.

**SIA (Silver)**

1. Confirmar detecção de competência (`PA_CMP`, `PA_DATREF`, `PA_MVM`).
2. Confirmar detecção do campo de município (`PA_MUNPCN`, `PA_CODMUN`, `PA_UFMUN`) e registrar qual coluna foi usada em dados reais 2022.
3. Validar que o campo `valor_aprovado` (`PA_VALAPR`) está sendo interpretado corretamente, sem multiplicação indevida pela quantidade.

### 4.3. Agregação — Silver → Gold

1. **Óbitos (Gold SIM)**
   - Verificar se a agregação em `gold.py` resulta em 1 linha por (cod_mun_ocorrencia, competencia, tipo_veiculo, faixa_etaria, sexo).
   - Garantir que nenhum JOIN com IBGE está removendo linhas (LEFT JOIN deve preservar todos os municípios presentes no Silver).

2. **Custos (Gold SIA)**
   - Garantir que a agregação não está misturando residência e atendimento.
   - Confirmar que o JOIN com IBGE está feito por prefixo de 6 dígitos e não elimina municípios sem correspondência.

### 4.4. Consumo — Gold → API → Dashboard

1. **Endpoints do dashboard** (`backend/routers/dashboard.py`):
   - Revisar consultas de `summary`, `mapa`, `municipios` para garantir que:
     - `SUM(total_obitos)` e `SUM(custo_total)` são calculados sobre as colunas agregadas do Gold.
     - Não há filtros implícitos adicionais (ex.: ano fixo, UF limitada) que expliquem a subcontagem.
2. **Frontend**:
   - Confirmar que os filtros padrão (ano, município, tipo de veículo) correspondem aos parâmetros esperados pela API.
   - Garantir que o dashboard “2022 / Geral” realmente não aplica filtro de UF/município.

---

## 5. Cronograma de Saneamento (Foco em 2022)

### Fase 1 — Auditoria Diagnóstica (D+3 dias)

1. **Reproduzir contagens brutas (SIM/SIA)** para 2022 a partir dos Parquets PySUS.
2. **Comparar com Gold e dashboard** (A1/B1 vs UI 2022).
3. **Registrar divergências** (por UF e por Brasil) neste PAC.

### Fase 2 — Correção de Modelagem de Município (D+7 dias)

1. Implementar segregação entre residência/ocorrência/atendimento conforme Seção 2.3.
2. Ajustar Gold para gerar fatos separados (`f_obitos_ocorrencia`, `f_obitos_residencia`, `f_custos_residencia`).
3. Atualizar API e dashboard para permitir seleção explícita do tipo de município.
4. Atualizar `docs/DADOS_MUNICIPIO.md`, `AGENTS.md` e `docs/BACKLOG_TAREFAS.md` com as novas regras.

### Fase 3 — Reprocessamento 2022 (D+10 dias)

1. Reexecutar ETL completo para 2022 (SIM + SIA) com as correções.
2. Comparar os novos totais com ONSV e SIMU (cross-check).
3. Gerar notebook de validação (`notebooks/02_auditoria_sim_sia_2022.ipynb`) com:
   - Queries replicando as metodologias externas.
   - Gráficos e mapas (matplotlib + GeoJSON) para comparação visual.

### Fase 4 — Normalização e Automação (D+15 dias)

1. Generalizar as correções para anos adicionais (2019–2024).
2. Automatizar testes de regressão:
   - Asserções de contagem mínima por ano/UF comparadas a benchmarks (tolerância definida).
3. Incorporar checagens de qualidade (UF × código, perda por DTOBITO, etc.) no pipeline, com logs estruturados.

---

[^onsv]: Observatório Nacional de Segurança Viária. *Dados Consolidados de Óbitos no Trânsito Brasileiro 2023*. Disponível em: https://onsv.github.io/analise-datasus-2023/datasus2023.html.

[^simu]: Ministério das Cidades. *Número de mortos em acidentes de trânsito por 100 mil habitantes* (SIMU). Disponível em: https://simu.cidades.gov.br/glossario/seguranca-viaria/numero-de-mortos-em-acidentes-de-transito-por-100-mil-habitantes/.

OBS: verificar se essas bases tem como unica fonte o SIM.