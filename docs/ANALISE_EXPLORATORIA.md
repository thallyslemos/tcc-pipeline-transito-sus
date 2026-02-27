# Análise Exploratória — Validação do Caminho

## Resumo

Análise exploratória minuciosa realizada com amostra de dados para validar o caminho escolhido para o sistema de apoio à decisão sobre acidentes de trânsito no SUS.

## Artefatos Analisados

- **ARCHITECTURE.md**: Arquitetura Medallion (Bronze → Silver → Gold), DuckDB, FastAPI, MCP
- **README.md**: Stack PySUS, DuckDB, Parquet, objetivos e iterações
- **TCC Súmula**: Contexto acadêmico, metodologia, CID-10 V01–V89

## Validações Realizadas

### 1. Schema e Filtro CID

- **CAUSABAS** (SIM) e **PA_CIDPRI** (SIA): compatíveis com filtro V01–V89
- Filtro implementado: `LEFT(codigo, 3) BETWEEN 'V01' AND 'V89'`
- Amostra sintética validou 100% dos registros como trânsito (por construção)

### 2. Agregação Município/Competência

- **CODMUNOCOR** (SIM) / **PA_UFMUN** (SIA): padronizados para `cod_mun_ibge`
- **DTOBITO** (SIM) / **PA_DATREF** (SIA): extraída competência (mês/ano)
- Agregação Gold: óbitos por `(cod_mun_ibge, competencia)`

### 3. Pipeline

- **Bronze**: Parquet bruto (ou amostra sintética)
- **Silver**: Filtro CID, tipagem, padronização
- **Gold**: Tabelas agregadas para consumo

### 4. DuckDB

- Leitura nativa de Parquet
- Views Gold funcionais
- Consultas OLAP performáticas

### 5. Interface

- API REST (FastAPI) operacional
- Dashboard responsivo com Chart.js e Tailwind

## Conclusão

O caminho está **validado**. Próximos passos:

1. Integrar SIA (custos) ao pipeline
2. Implementar servidor MCP
3. Expandir para dados reais do DATASUS (com rede)
