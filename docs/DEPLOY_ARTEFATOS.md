# Artefatos de dados para deploy (v1.0 DuckDB)

Lista de ficheiros que devem existir em `/opt/transito-sus/data` na VPS quando
`USE_POSTGRES=false`. Nada disto entra no Git — gere localmente com o pipeline
e envie por `rsync` ou `scp`.

Validar antes do envio:

```bash
uv run python scripts/list_deploy_artifacts.py
uv run python scripts/list_deploy_artifacts.py --strict   # exige conjunto completo
```

---

## Obrigatorio (dashboard, mapa, ranking, municipio)

| Caminho | Uso |
|---------|-----|
| `data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` | Mart SIM ocorrencia |
| `data/gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet` | Mart SIM residencia |
| `data/ibge_municipios.parquet` | Nomes e UFs canonicos |
| `data/ibge_populacao.parquet` | Denominadores populacao |
| `data/ibge_malhas_municipios.geojson` | Mapa coropletico (~3,6 MB) |

Sem a malha GeoJSON, `GET /api/sim/geo` devolve **503**.

---

## Completo (todas as paginas activas)

| Caminho | Paginas / endpoints |
|---------|---------------------|
| `data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet` | Fluxos, temporal (serie, dia-semana, outliers) |
| `data/gold/sim_prelim_municipio_mes_ocorrencia.parquet` | Preliminares |
| `data/gold/sim_prelim_municipio_mes_residencia.parquet` | Preliminares |
| `data/gold/frota_municipio_ano.parquet` | Indicadores SENATRAN / taxa por veiculo |

---

## Estrutura esperada na VPS

```text
/opt/transito-sus/
├── docker-compose.prod.yml
├── .env.prod
└── data/
    ├── gold/
    │   ├── sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet
    │   ├── sim_v1_obitos_municipio_mes_residencia_v2.parquet
    │   ├── sim_prelim_municipio_mes_ocorrencia.parquet      # opcional
    │   ├── sim_prelim_municipio_mes_residencia.parquet        # opcional
    │   └── frota_municipio_ano.parquet                      # opcional
    ├── silver/
    │   └── sim_v2_nacional_2010_2024_contract_v2.parquet    # opcional
    ├── ibge_municipios.parquet
    ├── ibge_populacao.parquet
    └── ibge_malhas_municipios.geojson
```

---

## Geracao local (resumo)

```bash
uv sync
# Amostra offline (~2 s) — apenas desenvolvimento
uv run python -m data-pipeline.run

# Producao real (ajuste UFs/anos ao escopo do TCC)
uv run python -m data-pipeline.run --real --ufs BA --anos 2010-2024
uv run python -m data-pipeline.run --sim-evidence --silver-v2
uv run python -m data-pipeline.run --ibge --malhas
uv run python scripts/list_deploy_artifacts.py --strict
```

---

## Envio para a VPS

```bash
# Preserva subpastas gold/ e silver/
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
  deploy@VPS:/opt/transito-sus/
```

Alternativa compactada:

```bash
tar czf transito-data.tar.gz \
  -C data \
  gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet \
  gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet \
  ibge_municipios.parquet ibge_populacao.parquet ibge_malhas_municipios.geojson
scp transito-data.tar.gz deploy@VPS:/opt/transito-sus/
ssh deploy@VPS 'cd /opt/transito-sus && tar xzf transito-data.tar.gz'
```

---

## Actualizacao de dados

1. Regenerar Parquet localmente.
2. `rsync` incremental (so ficheiros alterados).
3. `docker compose -f docker-compose.prod.yml restart api`

A API remonta views DuckDB na proxima conexao; nao e necessario rebuild da imagem.
