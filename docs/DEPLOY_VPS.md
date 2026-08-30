# Deploy em VPS (v1.0 — DuckDB embedded)

Guia principal para publicar o dashboard e a API em uma VPS Linux com Docker
Compose. A versão **1.0.0** usa **DuckDB in-process + Parquet** montados no
container (`USE_POSTGRES=false`) — cobertura completa das páginas (mapa,
fluxos, temporal, preliminares) com boa performance.

Para PostgreSQL como serving layer, veja [Alternativa PostgreSQL](#alternativa-postgresql-staging) abaixo.

---

## Visão geral

```text
[Maquina local]  pipeline ETL  -->  data/gold + data/silver + IBGE
                                        |
                                   rsync / scp
                                        v
[VPS]  GHCR images (api + web)  +  volume ./data:ro  -->  FastAPI + Next.js
```

Artefatos necessários: [DEPLOY_ARTEFATOS.md](DEPLOY_ARTEFATOS.md)

---

## Fase A — Preparar dados (máquina local)

```bash
cd tcc-pipeline-transito-sus
uv sync

# Desenvolvimento rapido (amostra offline)
uv run python -m data-pipeline.run

# Dados reais (ajuste UFs/anos ao escopo do TCC)
uv run python -m data-pipeline.run --real --ufs BA --anos 2010-2024
uv run python -m data-pipeline.run --sim-evidence --silver-v2
uv run python -m data-pipeline.run --ibge --malhas

# Validar antes de enviar
uv run python scripts/list_deploy_artifacts.py
uv run python scripts/list_deploy_artifacts.py --strict
```

---

## Fase B — Provisionar a VPS

1. **SO:** Ubuntu 22.04 ou 24.04 LTS
2. **Recursos:** minimo 2 vCPU, 4 GB RAM, 20 GB disco
3. **Instalar Docker** (Engine + Compose plugin):

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # reconecte o SSH
   docker compose version
   ```

4. **Firewall:** liberar 22 (SSH), 80 e 443 (HTTP/S). Nao exponha Postgres
   publicamente se usar a alternativa PostgreSQL.
5. **Criar diretorio de deploy:**

   ```bash
   sudo mkdir -p /opt/transito-sus/data
   sudo chown -R $USER:$USER /opt/transito-sus
   ```

---

## Fase C — Enviar dados para o servidor

Na maquina local (com Parquet gerado):

```bash
rsync -avz --progress \
  --relative \
  ./data/./gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet \
  ./data/./gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet \
  ./data/./gold/sim_prelim_municipio_mes_ocorrencia.parquet \
  ./data/./gold/sim_prelim_municipio_mes_residencia.parquet \
  ./data/./gold/frota_municipio_ano.parquet \
  ./data/./silver/sim_v2_nacional_2010_2024_contract_v2.parquet \
  ./data/./ibge_municipios.parquet \
  ./data/./ibge_populacao.parquet \
  ./data/./ibge_malhas_municipios.geojson \
  deploy@SEU_VPS:/opt/transito-sus/
```

Substitua `deploy@SEU_VPS` pelo utilizador e IP/domínio da VPS.

---

## Fase D — Publicar imagens (release Git)

No repositorio, apos merge na `main`:

```bash
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

O workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml)
publica automaticamente no GHCR:

- `ghcr.io/thallyslemos/tcc-pipeline-transito-sus-api:1.0.0`
- `ghcr.io/thallyslemos/tcc-pipeline-transito-sus-web:1.0.0`

Aguarde o GitHub Actions concluir antes de continuar na VPS.

---

## Fase E — Subir servicos na VPS

```bash
ssh deploy@SEU_VPS
cd /opt/transito-sus

# Copiar ficheiros de deploy do repo (ou via git clone minimo)
curl -fsSLO https://raw.githubusercontent.com/thallyslemos/tcc-pipeline-transito-sus/main/docker-compose.prod.yml
curl -fsSLO https://raw.githubusercontent.com/thallyslemos/tcc-pipeline-transito-sus/main/.env.prod.example
cp .env.prod.example .env.prod
# Edite .env.prod: API_URL, CORS_ORIGINS, IMAGE_TAG

# Login no GHCR (PAT GitHub com read:packages)
echo SEU_GITHUB_PAT | docker login ghcr.io -u SEU_USUARIO --password-stdin

docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f docker-compose.prod.yml ps
```

Variaveis em `.env.prod`:

| Variavel | Exemplo | Descricao |
|----------|---------|-----------|
| `IMAGE_TAG` | `1.0.0` | Tag semver (sem `v`) |
| `API_URL` | `https://api.seudominio.com` | URL publica da API (browser) |
| `CORS_ORIGINS` | `https://dashboard.seudominio.com` | Origem do frontend |
| `WEB_PORT` | `3000` | Porta exposta do Next.js |

---

## Fase F — Nginx + TLS (recomendado)

Exemplo com dois subdominios:

- `dashboard.seudominio.com` -> `127.0.0.1:3000` (web)
- `api.seudominio.com` -> `127.0.0.1:8000` (api) — publique a porta 8000
  apenas em localhost adicionando `ports: ["127.0.0.1:8000:8000"]` ao servico
  `api` se necessario, ou use rede Docker interna com proxy.

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d dashboard.seudominio.com -d api.seudominio.com
```

Actualize `.env.prod` com URLs `https://` e reinicie:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Fase G — Verificacao

```bash
curl -s https://api.seudominio.com/
curl -s "https://api.seudominio.com/api/sim/summary?ano=2024&uf=BA"
curl -s "https://api.seudominio.com/api/sim/geo?ano=2024&uf=BA" | head -c 200
```

No browser: abra `https://dashboard.seudominio.com` — mapa, ranking e pagina
Sobre devem carregar. O mapa com DuckDB deve responder em sub-segundo apos
warm-up.

---

## Fase H — Actualizar dados

1. Regenerar Parquet localmente (Fase A).
2. `rsync` incremental (Fase C).
3. Reiniciar API:

   ```bash
   docker compose -f docker-compose.prod.yml restart api
   ```

---

## Teste local antes da VPS

Com imagens locais (build) ou GHCR:

```bash
# Build local
docker build -f Dockerfile.backend -t transito-sus-api:local .
docker build -f frontend/Dockerfile -t transito-sus-web:local frontend

# Ou use docker-compose.prod.yml apos ajustar IMAGE_TAG e imagens
cp .env.prod.example .env.prod
# API_URL=http://localhost:8000  CORS_ORIGINS=http://localhost:3000
docker compose -f docker-compose.prod.yml --env-file .env.prod up
```

---

## Alternativa PostgreSQL (staging)

Para testar serving via Postgres (ADR-002) — **nao recomendado para v1.0**
devido a performance do mapa e rotas Silver ausentes:

[`docker-compose.serving.yml`](../docker-compose.serving.yml)

```bash
docker compose -f docker-compose.serving.yml up -d postgres
export DATABASE_URL=postgresql://transito:transito@localhost:5433/transito_sus
uv run python db/run_migrations.py
uv run python -m data-pipeline.run --load-postgres
docker compose -f docker-compose.serving.yml up --build api web
```

Detalhes: secções PostgreSQL abaixo e [ADR-002](adr/ADR-002_POSTGRES_SERVING.md).

---

## PostgreSQL — referencia (nao usado na v1.0 VPS)

### Passo a passo local com Docker + Postgres

1. `uv sync`
2. Gerar Parquet Gold
3. `docker compose -f docker-compose.postgres.yml up -d`
4. `export DATABASE_URL=postgresql://transito:transito@localhost:5433/transito_sus`
5. `uv run python db/run_migrations.py`
6. `uv run python -m data-pipeline.run --load-postgres`
7. `USE_POSTGRES=true` na API

### Compose auxiliar

- [`docker-compose.postgres.yml`](../docker-compose.postgres.yml): Postgres 16 porta 5433
- [`docker-compose.test.yml`](../docker-compose.test.yml): Postgres porta 5434 (pytest)

### Resolucao de problemas (Postgres)

- **`integer out of range` na carga:** reaplique `db/run_migrations.py` (migracao 002).
- **`cannot alter type of a column used by a view`:** actualize repo e rerun migracoes.
- **`no schema has been selected`:** verifique `POSTGRES_SCHEMA=public`.

---

## Referencias

- [DEPLOY_ARTEFATOS.md](DEPLOY_ARTEFATOS.md) — lista de ficheiros para rsync
- [MODELAGEM_DADOS.md](MODELAGEM_DADOS.md)
- [ADR-002 PostgreSQL](adr/ADR-002_POSTGRES_SERVING.md)
