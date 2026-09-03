# TimesFM — POC local e viabilidade (Ciclo 2)

> Documento de apoio à decisão sobre previsão mensal de óbitos. **Não expõe endpoint em produção.**

## Objetivo

Avaliar se o modelo TimesFM (Google Research) consegue projetar óbitos mensais por município com acurácia e custo operacional aceitáveis na EC2 `t3.small`, cruzando:

1. **Histórico consolidado** até 2024 (`sim_v1_obitos_*_v2.parquet`)
2. **Backtest hold-out** (treino até 2023, previsão 2024 vs real)
3. **Preliminares 2025** (`sim_prelim_*`) com maturidade via `/api/sim/prelim/completude`

## Script

```bash
# Listar municípios BA com mais óbitos em 2024
uv run python analysis/timesfm_poc.py --uf BA --list-top 5

# Backtest + projeção 2025 para Salvador (exemplo)
uv run python analysis/timesfm_poc.py --uf BA --cod-mun 2927408
```

Requisitos: Gold materializado localmente; pacote `timesfm` instalado (lock 1.3.0). O script usa **TimesFM 1.0** (`google/timesfm-1.0-200m-pytorch`), alinhado ao `backend/services/forecaster.py`.

## Estado atual do produto

| Componente | Status |
|------------|--------|
| `backend/services/forecaster.py` | TimesFM 1.0; lê views legadas `v_obitos` |
| `POST /api/predict/obitos` | Existe; não integrado ao mart SIM v2 |
| `/previsao` (frontend) | Stub |
| Preliminares 2025 | Rota `/preliminares` + API `sim_prelim` separada |

## Próximos passos (pós-POC)

1. **Migrar forecaster** para `sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet`
2. **Avaliar TimesFM 3** no HuggingFace — compatibilidade com pacote `timesfm` antes de upgrade
3. **Backtest sistemático** em 3–5 municípios BA (alto/baixo volume): MAPE, banda p10–p90
4. **Cruzamento 2025**: sobrepor previsão Jan–Dez/2025 com preliminares + completude estimada
5. **Decisão prod**: só expor UI/API se MAPE < limiar acordado e RAM/latência OK na EC2

## Riscos conhecidos

- **RAM**: carregar checkpoint 200M em CPU pode exceder `t3.small` (2 GiB) sob carga concorrente
- **Latência**: primeira inferência inclui download do HuggingFace + warm-up do modelo
- **Preliminares**: subnotificação nos primeiros meses distorce comparação com forecast anual
- **Mart legado**: forecaster ainda não consome Gold SIM v2 — métricas da POC leem Parquet diretamente

## Critérios de go/no-go sugeridos

| Critério | Go | No-go |
|----------|-----|-------|
| MAPE hold-out 12m (média 5 municípios) | < 25% | ≥ 35% |
| Tempo inferência (p95) | < 30s cold, < 5s warm | > 60s |
| RAM pico em EC2 | < 1.5 GiB | OOM ou swap |

---

*Gerado no Ciclo 2 do plano Filtros/Temporal/TimesFM — 2026-09-02*
