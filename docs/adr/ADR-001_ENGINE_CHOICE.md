# ADR-001: DuckDB + Parquet na camada de ETL

## Status

Aceito.

## Contexto

O pipeline precisa de agregações OLAP sobre ficheiros colunares, reprodutibilidade
local e baixa operação (sem servidor de base de dados na máquina do analista).

## Decisão

Usar **DuckDB** sobre **Apache Parquet** na arquitetura Medallion (Bronze → Silver
→ Gold), gerando artefactos versionáveis e auditáveis.

## Consequências

- Leitura analítica local rápida e SQL expressivo (incluindo `read_parquet`).
- Produção em VPS pode **não** montar todos os Parquets para servir muitos
  clientes; a camada de serviço pode migrar para PostgreSQL (ver ADR-002).
