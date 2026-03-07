# Arquitetura — Pipeline Analitico de Acidentes de Transito no SUS

Visao geral, decisoes, fluxo de dados e referencias metodologicas do MVP.

## 1. Visao do Sistema

```mermaid
flowchart TB
    subgraph Fontes[Fontes de Dados]
        SIM[SIM - Obitos]
        SIA[SIA - Ambulatorial]
        IBGE[IBGE - Populacao]
    end

    subgraph Pipeline[Pipeline ETL]
        PySUS[PySUS]
        IBGE_Fetch[IBGE Fetcher]
        Parquet[(Parquet)]
        DuckDB[(DuckDB)]
    end

    subgraph Consumo[Camadas de Consumo]
        FastAPI[FastAPI REST]
        MCP[MCP Server]
        LLM[LLM Local / Ollama]
        Next[Next.js Dashboard]
    end

    SIM --> PySUS
    SIA --> PySUS
    IBGE --> IBGE_Fetch
    IBGE_Fetch --> Parquet
    PySUS --> Parquet
    Parquet --> DuckDB
    DuckDB --> FastAPI
    DuckDB --> MCP
    MCP --> LLM
    FastAPI --> Next
```

## 2. Fluxo de Dados (Medallion)

```mermaid
flowchart LR
    subgraph Bronze[Bronze]
        B1[SIM raw .parquet]
        B2[SIA raw .parquet]
    end

    subgraph Silver[Silver]
        S1[Filtro CID V01-V89]
        S2[Tipagem + campos derivados]
    end

    subgraph IBGE[IBGE Parquets]
        IM[ibge_municipios.parquet]
        IP[ibge_populacao.parquet]
    end

    subgraph Gold[Gold]
        G1[Obitos por municipio/mes]
        G2[Custos por municipio/mes]
    end

    subgraph Indicadores[Indicadores Relativos]
        I1[Taxa mortalidade /100mil hab]
        I2[Custo per capita]
    end

    B1 --> S1
    B2 --> S1
    S1 --> S2
    S2 --> IM
    S2 --> IP
    S2 --> G1
    S2 --> G2
    IM --> G1
    IP --> G1
    G1 --> I1
    G2 --> I2
```

| Camada | Conteudo |
|--------|----------|
| Bronze | Dados brutos do SIM e SIA em Parquet |
| Silver | Filtrados (CID V01-V89), tipados, com campos derivados (tipo_veiculo, faixa_etaria) |
| IBGE | Parquets gerados por `ibge_fetcher`: localidades, malhas (lat/lon), populacao SIDRA |
| Gold | Tabelas agregadas por municipio/competencia, enriquecidas com nome, lat, lon e populacao quando IBGE existir |
| Indicadores | Taxas relativas usando populacao estimada (views v_ibge_populacao ou fallback) |

## 3. Componentes

### 3.1 Data Pipeline (`data-pipeline/`)

- **sample_data.py**: Dados amostrais; usa `ibge_municipios.parquet` se existir, senao 9 municipios fixos
- **bronze.py**: Ingestao bruta para Parquet
- **silver.py**: Filtragem CID + enriquecimento (tipo veiculo, faixa etaria, sexo)
- **datasus.py**: Download streaming via PySUS (SIM/SIA) com DuckDB COPY (disco→disco, sem pandas). Cache PySUS em `~/pysus/`. Bronze parts idempotentes.
- **ibge_fetcher.py**: Integracao com APIs IBGE (localidades v1, metadados v4 para centroide lat/lon, SIDRA populacao). Gera `data/ibge_municipios.parquet` e `data/ibge_populacao.parquet`
- **gold.py**: Agregacoes por municipio/competencia; enriquecimento com JOIN nos Parquets IBGE (nome, lat, lon, populacao)
- **ibge.py**: Leitura de populacao/info a partir dos Parquets IBGE (ou dicionarios fallback) + funcoes de taxa (taxa_por_100mil, custo_per_capita)
- **config.py**: Pydantic Settings (`.env`)
- **logging.py**: structlog (dev: console colorido, prod: JSON)

### 3.2 Backend (`backend/`)

- **FastAPI** com routers:
  - `/api/dashboard/*` - dados para graficos e mapa (lat/lon e nome vindos do Gold ou views IBGE)
  - `/api/indicadores/*` - taxas relativas com populacao/info do IBGE (views v_ibge_municipios, v_ibge_populacao ou fallback)
- **DuckDB** in-process: views sobre Gold e, quando existirem, sobre `data/ibge_municipios.parquet` e `data/ibge_populacao.parquet`
- **ibge.py**: Acesso a dados IBGE via views DuckDB com fallback para `data-pipeline.ibge`

### 3.3 MCP Server (`mcp-server/`)

- **FastMCP** com 5 tools:
  - `query_obitos` - consulta obitos com filtros
  - `query_custos` - consulta custos ambulatoriais
  - `query_taxa_mortalidade` - taxa por 100mil hab com populacao IBGE
  - `query_serie_temporal` - series mensais
  - `listar_municipios` - municipios disponiveis

### 3.4 Previsão IA (`backend/services/`)

- **TimesFM** (Google Research, 200M params, PyTorch CPU)
- Endpoint `/api/predict/{obitos|custos}/{cod_mun_ibge}`
- Horizonte: 12 meses com intervalos de confianca (P10-P90)
- Modelo carregado lazy (singleton, ~30s no primeiro request)

### 3.5 Frontend (`frontend/`)

- **Next.js 16** + Tailwind CSS v4 + Recharts
- **Leaflet** para mapas com circle markers proporcionais
- 5 paginas: Dashboard, Municipios, Mapa, Previsao IA, Chat IA
- FilterBar reutilizavel e desacoplado
- ForecastChart com serie historica + previsao + intervalo de confianca

## 4. Modelo de Dados (Gold)

```mermaid
erDiagram
    obitos_municipio_mes {
        string cod_mun_ibge PK
        date competencia PK
        string municipio
        string uf
        int ano
        int mes
        int total_obitos
        string tipo_veiculo
        string faixa_etaria
        string sexo
        double lat
        double lon
        int populacao_estimada
    }

    custos_municipio_mes {
        string cod_mun_ibge PK
        date competencia PK
        string municipio
        string uf
        int ano
        int mes
        decimal custo_total
        int total_procedimentos
        int total_atendimentos
        string tipo_veiculo
        string faixa_etaria
        double lat
        double lon
    }

    ibge_municipios {
        string cod_mun_ibge PK
        string nome
        string uf
        string regiao
        double lat
        double lon
    }

    ibge_populacao {
        string cod_mun_ibge PK
        int ano PK
        int populacao
    }
```

## 5. Indicadores Relativos

### 5.1 Taxa de Mortalidade por 100 mil habitantes

- **Formula**: `(obitos / populacao_estimada) * 100.000`
- **Referencia**: DATASUS - Ficha de Qualificacao C.12
- **URL**: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm
- **Justificativa**: Permite comparacao entre municipios de portes diferentes

### 5.2 Custo per capita

- **Formula**: `custo_total_sus / populacao_estimada`
- **Referencia**: Metodologia de contas em saude (OMS/RIPSA)
- **Justificativa**: Normaliza impacto financeiro pelo tamanho da populacao

### 5.3 Populacao Estimada

- **Fonte**: IBGE - Tabela 6579 SIDRA (Estimativas da Populacao Residente)
- **Metodologia**: Metodo matematico AiBi (projecoes por componentes demograficas)
- **Referencia**: 1o de julho de cada ano
- **URL**: https://sidra.ibge.gov.br/tabela/6579
- **API**: `https://apisidra.ibge.gov.br/values/t/6579/n6/{cod_ibge}/v/9324/p/{ano}`

## 6. MCP Server (Consulta em Linguagem Natural)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant LLM as Ollama (Qwen2.5 3B)
    participant MCP as MCP Server (FastMCP)
    participant DB as DuckDB

    U->>LLM: "Qual a taxa de mortalidade em Salvador em 2023?"
    LLM->>MCP: tool: query_taxa_mortalidade(municipio="Salvador", ano=2023)
    MCP->>DB: SELECT + calculo com populacao IBGE
    DB->>MCP: ResultSet
    MCP->>LLM: "Salvador: 120 obitos, pop 2.480.790, taxa 4.84/100mil"
    LLM->>U: "Salvador registrou taxa de 4,84 obitos por 100 mil habitantes..."
```

### Viabilidade para TCC de Baixo Custo

| Item | Opcao | Custo |
|------|-------|-------|
| LLM Local | Ollama + Qwen2.5 3B (Q4_K_M) | Gratuito |
| Requisitos | 4GB RAM, CPU moderno, ~2GB disco | Notebook pessoal |
| VPS MVP | Nautilus/Avira (4GB RAM) | R$ 40-80/mes |
| Stack completa | Python + DuckDB + Next.js | 100% open source |

**Ollama local**: Qwen2.5 3B roda em CPU a ~4.5 tokens/s com 3GB RAM. Ideal para demonstracao em notebook.

## 7. Tecnologias

| Camada | Tecnologia | Uso |
|--------|------------|-----|
| Extracao | PySUS | DATASUS, .dbc -> Parquet |
| Processamento | DuckDB | OLAP in-process, views Gold |
| Armazenamento | Parquet | Bronze/Silver/Gold (colunar) |
| Dados demograficos | IBGE API (Tabela 6579) | Populacao estimada |
| Backend | FastAPI + Pydantic Settings | API REST + config |
| IA Conversacional | FastMCP + Ollama | MCP Server + LLM local |
| IA Preditiva | TimesFM (Google Research) | Previsao de series temporais |
| Frontend | Next.js 16, Tailwind, Recharts | Dashboards |
| Mapas | Leaflet | Circle markers, tooltips |
| Logging | structlog | JSON (prod) / console (dev) |
| Testes | pytest | Pipeline + API + integracao |
| Lint | ruff | PEP8 + imports + security |

## 8. Referencias Tecnicas

1. BRASIL. Ministerio da Saude. DATASUS. **Ficha de Qualificacao C.12 - Taxa de Mortalidade por Causas Externas**. Disponivel em: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm

2. IBGE. **Estimativas da Populacao Residente - Tabela 6579**. Sistema IBGE de Recuperacao Automatica (SIDRA). Disponivel em: https://sidra.ibge.gov.br/tabela/6579

3. IBGE. **Metodologia das Estimativas da Populacao Residente**. Metodo AiBi. Disponivel em: https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html

4. MODEL CONTEXT PROTOCOL. **Introduction and Core Concepts**. Anthropic, 2024. Disponivel em: https://modelcontextprotocol.io

5. COELHO, Flavio Codecco et al. **PySUS: A library to open DATASUS files in Python**. GitHub, 2021. Disponivel em: https://github.com/AlertaDengue/PySUS

6. RAASCH, C. **DuckDB in Action**. Manning Publications, 2023.

7. OBSERVATORIO NACIONAL DE SEGURANCA VIARIA (ONSV). **Retrato da Seguranca Viaria no Brasil**. Campinas: ONSV, 2023.

8. OMS/RIPSA. **Indicadores e Dados Basicos para a Saude no Brasil (IDB)**. Rede Interagencial de Informacoes para a Saude.
