# Segurança — Pipeline Trânsito no SUS

> Modelo de ameaça e controles implementados. Atualizado: 2026-09-03.

## Modelo de ameaça

| Ativo | Sensibilidade | Exposição |
|-------|---------------|-----------|
| Parquet Gold (SIM) | Pública (microdados agregados) | VPS, read-only |
| API REST | Leitura pública | Internet via HTTPS |
| Credenciais Postgres | Alta | Apenas server-side (futuro) |
| TimesFM / MCP | Recurso computacional | Desligado em produção |

**Riscos principais:** SQL injection, esgotamento de CPU/RAM (DoS), misconfiguration de CORS/TLS.

## Controles implementados

### Aplicação (FastAPI)

| Controle | Implementação |
|----------|---------------|
| SQL injection | `cod6_seguro`, `uf_seguro`, `_literal_sql`, `ilike_clause` em `backend/routers/utils.py` |
| MCP bridge | `MCP_BRIDGE_ENABLED=false` em produção (router não montado) |
| TimesFM predict | `PREDICT_ENABLED=false` em produção |
| Rate limiting | `RateLimitMiddleware` — 60 req/min (10/min rotas pesadas) |
| CORS | Origens explícitas; sem `*`; só GET; sem credentials |
| Fail-fast prod | `validate_production_settings()` na subida |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |

### Frontend (Next.js / Vercel)

| Controle | Implementação |
|----------|---------------|
| Security headers | `frontend/next.config.ts` |
| API URL | Runtime via `/runtime-config` (não é segredo) |

### Infra (VPS)

| Controle | Implementação |
|----------|---------------|
| TLS | Nginx + Certbot (exemplo em `deploy/nginx/`) |
| Rate limit edge | Nginx `limit_req_zone` |
| Bind local | API e web em `127.0.0.1` no compose prod |
| Firewall | SG/UFW: 22, 80, 443 apenas |
| Secrets | `.env.prod` gitignored; chmod 600 na VPS |

## Variáveis de ambiente

| Variável | Dev | Produção |
|----------|-----|----------|
| `APP_ENV` | `development` | `production` |
| `CORS_ORIGINS` | localhost | URL exata Vercel |
| `MCP_BRIDGE_ENABLED` | `true` | **`false`** |
| `PREDICT_ENABLED` | `true` | **`false`** |
| `RATE_LIMIT_RPM` | `120` | `60` |

## Testes

```bash
uv run pytest tests/test_security.py -v
```

## Referências

- [docs/ATUALIZACAO_AMBIENTES.md](ATUALIZACAO_AMBIENTES.md) — rollout back/front
- [docs/DEPLOY_VPS.md](DEPLOY_VPS.md) — setup inicial
