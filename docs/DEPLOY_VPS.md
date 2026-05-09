# Deploy em VPS com PostgreSQL

Este guia descreve o fluxo mínimo para servir a API em produção com PostgreSQL
como camada de dados, sem montar o diretório completo `data/gold/*.parquet`.

## Pré-requisitos

- Máquina Linux com Docker (opcional) ou PostgreSQL 16+ instalado.
- Parquets Gold e IBGE gerados localmente (ou em CI) pelo pipeline.
- Variáveis `DATABASE_URL`, `USE_POSTGRES=true` e `POSTGRES_SCHEMA` (default
  `public`) na API.

---

## Passo a passo completo (local com Docker + API + Postgres)

Ordem fixa; cada passo depende do anterior.

1. **Instalar dependências Python** (na raiz do repositório `tcc-pipeline-transito-sus`):
   ```bash
   uv sync
   ```

2. **Gerar Parquet Gold (e IBGE) no disco** — sem isto a carga falha:
   ```bash
   uv run python -m data-pipeline.run
   ```
   Ou o seu fluxo real (`--real`, `--gold`, etc.) até existirem pelo menos:
   `data/gold/obitos_ocorrencia_municipio_mes.parquet` (ou legado `obitos_municipio_mes.parquet`),
   `data/gold/custos_municipio_mes.parquet` se quiser custos, e opcionalmente
   `data/ibge_municipios.parquet` / `data/ibge_populacao.parquet`.

3. **Subir o PostgreSQL** (exemplo na porta 5433):
   ```bash
   docker compose -f docker-compose.postgres.yml up -d
   ```
   Aguarde o healthcheck (`pg_isready`) ficar verde (~5–15 s).

4. **Definir a URL de ligação** (ajuste host/porta se necessário):
   ```bash
   export DATABASE_URL=postgresql://transito:transito@localhost:5433/transito_sus
   ```
   Opcional: `export POSTGRES_SCHEMA=public` (valor por omissão).

5. **Aplicar todas as migrações** (inclui correções de tipos `BIGINT` para evitar
   `integer out of range` na carga a partir de Parquet int64):
   ```bash
   uv run python db/run_migrations.py
   ```
   Se já tinha corrido migrações antigas, **volte a executar este comando** após
   `git pull` para aplicar ficheiros novos em `db/migrations/*.sql`.

6. **Carregar Parquet → Postgres** (idempotente: `TRUNCATE` + insert):
   ```bash
   uv run python -m data-pipeline.run --load-postgres
   ```

7. **Configurar a API para ler Postgres** — no `.env` na raiz do backend/projeto
   (ou copie de `.env.example`):
   ```bash
   USE_POSTGRES=true
   DATABASE_URL=postgresql://transito:transito@localhost:5433/transito_sus
   POSTGRES_SCHEMA=public
   ```

8. **Iniciar o backend**:
   ```bash
   uv run uvicorn backend.app:app --reload --port 8000
   ```

9. **Frontend** (opcional): em `frontend/.env.local` mantenha a API alcançável,
   por exemplo:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
   Depois: `cd frontend && npm install && npm run dev`.

**Verificação rápida:** `curl -s http://localhost:8000/ | jq` e
`curl -s "http://localhost:8000/api/dashboard/summary" | jq '.total_obitos'`.

---

## Passos (resumo produção / VPS)

1. **Criar a base e o utilizador** (exemplo):
   ```sql
   CREATE DATABASE transito_sus;
   CREATE USER transito_api WITH PASSWORD '***';
   GRANT CONNECT ON DATABASE transito_sus TO transito_api;
   ```

2. **Aplicar migrações** (na raiz do repositório):
   ```bash
   export DATABASE_URL=postgresql://usuario:senha@host:5432/transito_sus
   uv sync
   uv run python db/run_migrations.py
   ```

3. **Carregar dados a partir dos Parquets** (máquina que tem `data/gold`):
   ```bash
   export DATABASE_URL=postgresql://usuario:senha@host:5432/transito_sus
   uv run python -m data-pipeline.run --load-postgres
   ```

4. **Permissões**: conceder `SELECT` nas views/tabelas ao utilizador só de
   leitura da API; evitar `SUPERUSER` na aplicação.

5. **Subir a API** com `.env` de produção:
   ```bash
   USE_POSTGRES=true
   DATABASE_URL=postgresql://transito_api:***@host:5432/transito_sus
   POSTGRES_SCHEMA=public
   uv run uvicorn backend.app:app --host 0.0.0.0 --port 8000
   ```

6. **Backup**: agendar `pg_dump` (lógico) e manter os Parquet Gold como
   arquivo para reconstrução completa da base.

## Compose de exemplo

- [docker-compose.postgres.yml](../docker-compose.postgres.yml): Postgres 16 na
  porta **5433** (desenvolvimento local ou staging).
- [docker-compose.test.yml](../docker-compose.test.yml): Postgres na porta
  **5434** para `pytest` com `TEST_DATABASE_URL`.

```bash
docker compose -f docker-compose.postgres.yml up -d
export DATABASE_URL=postgresql://transito:transito@localhost:5433/transito_sus
uv run python db/run_migrations.py
uv run python -m data-pipeline.run --load-postgres
```

## Segurança

- TLS (`sslmode=require`) quando a base não está na mesma rede privada.
- Pool e timeouts configurados no proxy (PgBouncer) se o tráfego crescer.
- Não expor a porta PostgreSQL publicamente sem firewall.

## Resolução de problemas

- **`psycopg.errors.NumericValueOutOfRange: integer out of range`** na carga:
  tipos `INTEGER` (32 bits) no Postgres são demasiado estreitos para alguns
  valores int64 dos Parquets (`populacao_estimada`, `ano`/`mes` em certos
  ficheiros, etc.). Corra de novo `uv run python db/run_migrations.py` para
  aplicar `002_widen_integer_columns.sql` e repita o passo `--load-postgres`.

- **`cannot alter type of a column used by a view`**: a migração `002` remove
  temporariamente as views `v_*`, altera as tabelas `gold_*` / `dim_*` e
  recria as views. Atualize o repositório e volte a correr `db/run_migrations.py`.

- **`no schema has been selected to create in`**: costuma ser `POSTGRES_SCHEMA`
  inválido ou vazio no `.env`, ou sessão sem `search_path` antes do primeiro
  `CREATE TABLE`. O runner passa `options=-c search_path=<schema>,public` no
  `psycopg.connect` e sanitiza o nome do schema (apenas `[a-zA-Z0-9_]`).

## Referências

- [docs/MODELAGEM_DADOS.md](MODELAGEM_DADOS.md)
- [docs/adr/ADR-002_POSTGRES_SERVING.md](adr/ADR-002_POSTGRES_SERVING.md)
