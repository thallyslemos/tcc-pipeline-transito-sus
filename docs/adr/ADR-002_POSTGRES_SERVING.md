# ADR-002: PostgreSQL como fonte de verdade em produção

## Status

Aceito.

## Contexto

DuckDB in-process com views sobre Parquet é adequado para desenvolvimento e
análise, mas em VPS com **vários clientes** e conexões simultâneas torna-se
frágil (ficheiros volumosos, single-writer, menos tooling de réplica/backup).

## Decisão

- **Local / ETL**: manter DuckDB + Parquet como artefacto principal do pipeline,
  com carga **opcional** para PostgreSQL (`--load-postgres`).
- **Produção (VPS)**: a API FastAPI e o MCP leem **PostgreSQL** como fonte de
  verdade operacional, configurado via `DATABASE_URL` e `USE_POSTGRES=true`.
- **Parquet** permanece como artefacto de ETL, arquivo e reconstrução da base
  (`pg_restore` / nova carga a partir de Gold).

## Consequências

- SQL de leitura deve ser compatível com PostgreSQL nas rotas que suportam o
  modo Postgres (ver `backend/sql_dialect.py` para funções de data).
- Migrações versionadas em `db/migrations/` definem o schema canónico.
- Operação: backups com `pg_dump`, utilizador com permissões mínimas para a API.
