# Modelagem de dados

Este documento descreve o modelo lógico consumido pela API e pelo MCP, em
alinhamento com os Parquets da camada Gold e com o schema PostgreSQL de
serviço.

## Camada Gold (Parquet)

As tabelas agregadas por município e competência mensal são geradas pelo
pipeline (`data-pipeline/gold.py`) e lidas em desenvolvimento via DuckDB
in-memory (`backend/database.py` em modo DuckDB).

| Artefato | Conteúdo |
|----------|----------|
| `sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` | Mart SIM-only (ocorrência) — dashboard `/api/sim/*` |
| `sim_v1_obitos_municipio_mes_residencia_v2.parquet` | Mart SIM-only (residência) |
| `obitos_ocorrencia_municipio_mes.parquet` | Óbitos por local de ocorrência (legado dashboard) |
| `obitos_residencia_municipio_mes.parquet` | Óbitos por residência (legado dashboard) |
| `custos_municipio_mes.parquet` | Custos SIA/PA agregados |
| `data/ibge_municipios.parquet` | Nome, UF, região, lat/lon |
| `data/ibge_populacao.parquet` | População estimada por município e ano |

Chaves de negócio típicas nas fact tables: `cod_mun_ibge`, `competencia`,
`tipo_veiculo`, `faixa_etaria` (e `sexo` nos óbitos).

## Camada PostgreSQL (serviço)

Em produção na VPS, os mesmos dados são materializados em tabelas relacionais
após `db/migrations/*.sql` e carga com `uv run python -m data-pipeline.run
--load-postgres` (ou `data-pipeline.postgres_load.load_gold_to_postgres`).

### Tabelas físicas

| Tabela | Origem Parquet |
|--------|----------------|
| `gold_sim_obitos_ocorrencia` | `sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` |
| `gold_sim_obitos_residencia` | `sim_v1_obitos_municipio_mes_residencia_v2.parquet` |
| `gold_obitos_ocorrencia` | `obitos_ocorrencia_municipio_mes.parquet` |
| `gold_obitos_residencia` | `obitos_residencia_municipio_mes.parquet` |
| `gold_custos` | `custos_municipio_mes.parquet` |
| `dim_ibge_municipio` | `ibge_municipios.parquet` |
| `dim_ibge_populacao` | `ibge_populacao.parquet` |

### Views de compatibilidade

O backend usa os mesmos nomes lógicos que no DuckDB:

| View | Definição |
|------|-----------|
| `v_sim_obitos_ocorrencia` | `SELECT * FROM gold_sim_obitos_ocorrencia` (dashboard SIM) |
| `v_sim_obitos_residencia` | `SELECT * FROM gold_sim_obitos_residencia` |
| `v_obitos_ocorrencia` | `SELECT * FROM gold_obitos_ocorrencia` |
| `v_obitos_residencia` | `SELECT * FROM gold_obitos_residencia` |
| `v_obitos` | Alias da ocorrência (`v_obitos_ocorrencia`) |
| `v_custos` | `SELECT * FROM gold_custos` |
| `v_ibge_municipios` | Colunas `cod_mun_ibge`, `nome`, `uf`, `regiao`, `lat`, `lon` |
| `v_ibge_populacao` | `cod_mun_ibge`, `ano`, `populacao` |

### Índices

Definidos em `db/migrations/001_init.sql` e `003_sim_marts.sql` para filtros
frequentes da API: `(ano, uf, cod_mun_ibge)`, `competencia` nas fact tables,
`(ano, uf, cod_mun_ibge_6)` nos marts SIM, e `(ano, cod_mun_ibge)` em população.

Fluxos residência–ocorrência e temporal por dia da semana leem a Silver
(`sim_v2_nacional_2010_2024_contract_v2.parquet`) e **não** entram no Postgres
nesta fase: esses endpoints respondem `503` com `USE_POSTGRES=true`. A série
mensal (`/api/sim/temporal/serie-mensal`) usa o mart Gold e funciona em ambos.

### Carga idempotente

A carga faz `TRUNCATE` das tabelas fact/dim do schema configurado
(`POSTGRES_SCHEMA`, default `public`) e reinsere a partir dos Parquets. SIA
ausente: o ficheiro `custos_municipio_mes.parquet` pode não existir; a carga
regista aviso e mantém a tabela vazia.

## Referências

- [docs/PIPELINE_ETL.md](PIPELINE_ETL.md)
- [docs/adr/ADR-002_POSTGRES_SERVING.md](adr/ADR-002_POSTGRES_SERVING.md)
