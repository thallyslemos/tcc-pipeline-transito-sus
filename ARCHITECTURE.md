# Arquitetura — Pipeline Analítico de Acidentes de Trânsito no SUS

Visão geral, decisões e fluxo de dados do MVP.

## 1. Visão do Sistema

```mermaid
flowchart TB
    subgraph Fontes[Fontes]
        FTP[FTP DATASUS]
        SIM[SIM - Óbitos]
        SIA[SIA - Ambulatorial]
    end

    subgraph Pipeline[Pipeline]
        PySUS[PySUS]
        Parquet[(Parquet)]
        DuckDB[(DuckDB)]
    end

    subgraph Consumo[Consumo]
        FastAPI[FastAPI]
        MCP[MCP Server]
        LLM[Agente IA]
    end

    FTP --> SIM
    FTP --> SIA
    SIM --> PySUS
    SIA --> PySUS
    PySUS --> Parquet
    Parquet --> DuckDB
    DuckDB --> FastAPI
    DuckDB --> MCP
    MCP --> LLM
```

O sistema ingere dados brutos (.dbc) do SIM e SIA via PySUS, converte para Parquet, processa em DuckDB e expõe via FastAPI e servidor MCP.

## 2. Fluxo de Dados (Medallion)

```mermaid
flowchart LR
    subgraph Bronze[Bronze]
        DBC[Arquivos .dbc]
        B1[SIM raw]
        B2[SIA raw]
    end

    subgraph Silver[Silver]
        S1[Filtro CID V01-V89]
        S2[Tipagem e padronização]
    end

    subgraph Gold[Gold]
        G1[Óbitos por município/mês]
        G2[Custos por município/mês]
    end

    DBC --> B1
    DBC --> B2
    B1 --> S1
    B2 --> S1
    S1 --> S2
    S2 --> G1
    S2 --> G2
```

| Camada | Conteúdo |
|--------|----------|
| Bronze | Arquivos .dbc baixados e convertidos para Parquet |
| Silver | Dados filtrados (CID V01–V89), tipados e padronizados |
| Gold | Tabelas/views agregadas por município (IBGE) e competência |

## 3. Componentes

```mermaid
flowchart TB
    subgraph Data[Camada de Dados]
        ETL[data-pipeline]
        DWH[(DuckDB)]
    end

    subgraph Backend[Backend]
        API[FastAPI]
    end

    subgraph AI[Camada Semântica]
        MCP_Server[MCP Server]
        Tools[Tools: query_custos, query_obitos, query_series]
    end

    subgraph Frontend[Frontend]
        Next[Next.js]
        Mapas[Leaflet/MapLibre]
    end

    ETL --> DWH
    DWH --> API
    DWH --> MCP_Server
    MCP_Server --> Tools
    API --> Next
    Next --> Mapas
```

### 3.1 Ingestão e Transformação

- **PySUS:** acesso ao FTP do DATASUS, leitura de .dbc e conversão.
- **Parquet:** armazenamento colunar, particionado por UF/ano.
- **DuckDB:** OLAP local, leitura nativa de Parquet, SQL para agregações.

### 3.2 Camada de Serviço

- **FastAPI:** API REST para dashboards e mapas.
- **MCP Server:** expõe tools que traduzem linguagem natural em SQL.

### 3.3 Camada de Apresentação

- **Next.js:** dashboards, gráficos e mapas coropléticos.
- **Leaflet/MapLibre:** visualização de GeoJSON por município.

## 4. Modelo de Dados (Gold)

```mermaid
erDiagram
    v_obitos_transito {
        string cod_mun_ibge PK
        date competencia PK
        int obitos
        string causabas
    }

    v_custos_transito {
        string cod_mun_ibge PK
        date competencia PK
        decimal custo_total
        int procedimentos
    }
```

Tabelas Gold unificadas por `cod_mun_ibge` (IBGE) e `competencia` (mês/ano).

## 5. Sequência MCP (Consulta em Linguagem Natural)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant LLM as Modelo
    participant MCP as MCP Server
    participant DB as DuckDB

    U->>LLM: "Qual o gasto com motos em VC em 2023?"
    LLM->>MCP: tool: query_custos_municipio(municipio="Vitória da Conquista", ano=2023, tipo="moto")
    MCP->>DB: SELECT ... WHERE cod_mun = '2933307' AND ano = 2023 AND cid LIKE 'V2%'
    DB->>MCP: ResultSet
    MCP->>LLM: {"custo_total": 125000.00, ...}
    LLM->>U: "O gasto público com vítimas de moto em Vitória da Conquista em 2023 foi R$ 125 mil..."
```

## 6. Iterações e Dependências

```mermaid
flowchart TD
    I1[I1: EDA com PySUS]
    I2[I2: Pipeline ETL]
    I3[I3: DuckDB DWH]
    I4[I4: MCP Server]
    I5[I5: POC]

    I1 --> I2
    I2 --> I3
    I3 --> I4
    I4 --> I5

    I1 -.->|valida schema| I3
    I2 -.->|Parquet| I3
    I3 -.->|views| I4
```

## 7. Tecnologias

| Camada | Tecnologia | Uso |
|--------|------------|-----|
| Extração | PySUS | DATASUS, .dbc → Parquet |
| Processamento | DuckDB | OLAP, views Gold |
| Armazenamento | Parquet | Bronze/Silver |
| Backend | FastAPI | API REST |
| IA | FastMCP | MCP + tools |
| Frontend | Next.js, Tailwind, shadcn/ui | Dashboards |
| Mapas | Leaflet / MapLibre | GeoJSON coroplético |
