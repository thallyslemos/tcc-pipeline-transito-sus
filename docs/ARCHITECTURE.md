# Arquitetura — Pipeline Analítico de Acidentes de Trânsito no SUS

Visão geral, decisões, fluxo de dados e referências metodológicas do MVP.

## 1. Visão do Sistema

```mermaid
flowchart TB
    subgraph Fontes[Fontes de Dados]
        SIM[SIM - Óbitos]
        SIA[SIA - Ambulatorial]
        IBGE[IBGE - Demografia]
    end

    subgraph "Pipeline ETL (data-pipeline)"[Pipeline ETL]
        PySUS[PySUS Fetcher]
        IBGE_Fetch[IBGE Fetcher]
        Parquet[(Parquet)]
        DuckDB[(DuckDB Engine)]
    end

    subgraph "Camadas de Consumo"[Camadas de Consumo]
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

## 2. Fluxo de Dados (Arquitetura Medallion)

A arquitetura de dados segue o padrão Medallion, garantindo qualidade e rastreabilidade progressivas.

```mermaid
flowchart LR
    subgraph Bronze[Bronze Raw]
        direction LR
        B1[sim_parts/*.parquet]
        B2[sia_parts/*.parquet]
    end

    subgraph Silver[Silver Enriched]
        direction LR
        S1[sim.parquet]
        S2[sia.parquet]
    end

    subgraph IBGE[IBGE Datasets]
        direction LR
        IM[ibge_municipios.parquet]
        IP[ibge_populacao.parquet]
    end

    subgraph Gold[Gold Aggregated]
        direction TB
        G_Ocorrencia[obitos_ocorrencia_municipio_mes]
        G_Residencia[obitos_residencia_municipio_mes]
        G_Custos[custos_municipio_mes]
    end
    
    subgraph Indicadores[Views e Indicadores]
        I1[Taxa Mortalidade / 100mil hab]
        I2[Custo per capita]
    end

    B1 --> S1
    B2 --> S2
    
    S1 --> G_Ocorrencia
    S1 --> G_Residencia
    S2 --> G_Custos
    
    G_Ocorrencia & G_Residencia & G_Custos -- Enriquecimento --> IM
    G_Ocorrencia & G_Residencia & G_Custos -- Enriquecimento --> IP
    
    IM & IP -- Join --> G_Ocorrencia & G_Residencia & G_Custos
    
    G_Ocorrencia --> I1
    G_Residencia --> I1
    G_Custos --> I2
```

| Camada | Conteúdo | Propósito |
|---|---|---|
| **Bronze** | Dados brutos do SIM e SIA em Parquet, particionados por UF e ano. | Cópia fiel da fonte, otimizada para acesso rápido. |
| **Silver** | Dados filtrados (CID V01-V89), com tipos corrigidos e campos derivados (tipo_veiculo, faixa_etaria, sexo_desc). | Base limpa e padronizada para análise. |
| **IBGE** | Parquets gerados por `ibge_fetcher`: localidades, malhas, população. | Fonte de dados demográficos para enriquecimento. |
| **Gold** | Tabelas agregadas por município/competência, separadas por conceito. | Views de negócio pré-calculadas para consumo rápido pela API. |

## 3. Modelo de Dados (Camada Gold)

A camada Gold foi refatorada para separar explicitamente os fatos por dimensão de localidade, resolvendo ambiguidades analíticas.

```mermaid
erDiagram
    obitos_ocorrencia_municipio_mes {
        string cod_mun_ibge PK "FK, (CODMUNOCOR)"
        date competencia PK
        string tipo_veiculo PK
        string faixa_etaria PK
        string sexo PK
        string municipio
        string uf
        int ano
        int mes
        int total_obitos
        double lat
        double lon
        int populacao_estimada
    }

    obitos_residencia_municipio_mes {
        string cod_mun_ibge PK "FK, (CODMUNRES)"
        date competencia PK
        string tipo_veiculo PK
        string faixa_etaria PK
        string sexo PK
        string municipio
        string uf
        int ano
        int mes
        int total_obitos
        double lat
        double lon
        int populacao_estimada
    }

    custos_municipio_mes {
        string cod_mun_ibge PK "FK, (PA_MUNPCN)"
        date competencia PK
        string tipo_veiculo PK
        string faixa_etaria PK
        string municipio
        string uf
        int ano
        int mes
        decimal custo_total
        int total_procedimentos
        int total_atendimentos
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

    obitos_ocorrencia_municipio_mes }o--|| ibge_municipios : "enriquecido por"
    obitos_residencia_municipio_mes }o--|| ibge_municipios : "enriquecido por"
    custos_municipio_mes }o--|| ibge_municipios : "enriquecido por"
    
    obitos_ocorrencia_municipio_mes }o--|| ibge_populacao : "enriquecido por"
    obitos_residencia_municipio_mes }o--|| ibge_populacao : "enriquecido por"

```

**Principais Mudanças:**

- **Desambiguação de Óbitos**: A tabela `obitos_municipio_mes` foi dividida em `obitos_ocorrencia_municipio_mes` e `obitos_residencia_municipio_mes`.
- **Chaves Primárias**: As chaves primárias foram expandidas para incluir as dimensões de análise (`tipo_veiculo`, `faixa_etaria`, `sexo`) para refletir a granularidade real das tabelas.
- **Clareza Semântica**: O modelo de dados agora reflete explicitamente a diferença entre o local **onde o óbito ocorreu** e onde a **vítima residia**, permitindo análises mais precisas.

## 4. Componentes e Tecnologias

A stack tecnológica permanece a mesma, mas a lógica interna dos componentes foi aprimorada.

| Camada | Tecnologia | Uso |
|---|---|---|
| Extração | PySUS | DATASUS, .dbc -> Parquet |
| Processamento | DuckDB | OLAP in-process, agregação para a camada Gold |
| Armazenamento | Parquet | Bronze/Silver/Gold (colunar) |
| Dados demográficos| IBGE API (SIDRA, etc.) | População, coordenadas, malhas |
| Backend | FastAPI + Pydantic | API REST para servir os dados da camada Gold |
| IA Preditiva | TimesFM | Previsão de séries temporais |
| IA Conversacional| FastMCP + Ollama | Servidor de contexto para consultas em linguagem natural |
| Frontend | Next.js, Tailwind, Recharts, MapLibre GL JS | Dashboards e visualizações |
| Testes | pytest | Testes unitários e de integração para pipeline e API |
| Qualidade | ruff | Linting e formatação de código |

---

## 5. Indicadores Relativos e Dimensões de Análise

### 5.1. Taxa de Mortalidade por 100 mil habitantes

- **Fórmula**: `(total_de_obitos / populacao_estimada) * 100.000`
- **Contexto**: Pode ser calculada tanto por **ocorrência** quanto por **residência**, dependendo da tabela Gold utilizada.
- **Padrão do Sistema**: Por padrão, o sistema deve exibir a taxa por **ocorrência**, que reflete o risco do local, mas deve permitir ao usuário alternar para a visão por **residência**.

### 5.2. Custo per capita

- **Fórmula**: `custo_total_sus / populacao_estimada`
- **Contexto**: A base SIA/PA atribui o custo ao **município de residência do paciente** (`PA_MUNPCN`). Portanto, este indicador reflete o ônus financeiro para o município de origem do paciente, não necessariamente onde o atendimento ocorreu.

### 5.3. Dimensões Geográficas

O sistema suportará filtros em três níveis de granularidade geográfica:

1.  **Município**: Filtro por município de ocorrência (padrão) ou residência.
2.  **UF (Estado)**: Filtro por Unidade da Federação.
3.  **Região**: Uma abstração que agrupa UFs (Norte, Nordeste, Sudeste, Sul, Centro-Oeste).

---

## 6. Referências Técnicas

As referências técnicas e metodológicas permanecem as mesmas listadas na versão anterior do documento e no pré-projeto de pesquisa.
