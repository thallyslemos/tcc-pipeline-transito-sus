# ADR-001: Arquitetura de Banco de Dados para Produção

## Status

**Aceito** - 2026-04-05

## Contexto

O sistema de Pipeline Analítico de Acidentes de Trânsito no SUS precisa evoluir de um protótipo local para uma aplicação em produção com múltiplos usuários simultâneos. Atualmente, utilizamos DuckDB com arquivos Parquet para todas as camadas (Bronze, Silver, Gold) e a API FastAPI lê diretamente desses arquivos.

### Problemas Identificados

1. **Concorrência no DuckDB**: DuckDB suporta múltiplos leitores simultâneos, mas apenas **um escritor por arquivo** (single-writer constraint). Isso limita:
   - Atualizações em tempo real por múltiplos processos
   - Logs de auditoria simultâneos
   - Cache de usuários com escritas concorrentes
   - Escalabilidade horizontal (múltiplos workers)

2. **Gerenciamento em Produção**: 
   - DuckDB não possui ferramentas nativas de backup, replicação ou monitoramento
   - Controle de acesso granular (GRANT/REVOKE) é limitado
   - Connection pooling não é suportado nativamente

3. **Custo-Benefício**: VPS básica com recursos limitados precisa de solução eficiente.

## Decisão

Adotar uma **arquitetura híbrida**:

| Camada | Tecnologia | Responsabilidade |
|--------|------------|------------------|
| **ETL (Local/CI)** | DuckDB + Parquet | Processamento pesado, transformações complexas |
| **Produção (VPS)** | PostgreSQL | Consultas multi-usuário, API, concorrência |

### Fluxo de Dados

```mermaid
flowchart TB
    subgraph "ETL - Ambiente Local/CI"
        B[Bronze<br/>Parquet RAW]
        S[Silver<br/>Parquet Filtrado]
        G[Gold<br/>Parquet Agregado]
        
        B -->|processar_silver| S
        S -->|gerar_gold| G
    end
    
    subgraph "Sync - Python Script"
        SYNC[Sync to Postgres<br/>INSERT/UPSERT]
        G --> SYNC
    end
    
    subgraph "Produção - VPS"
        PG[(PostgreSQL)]
        API[FastAPI]
        FE[Frontend<br/>Next.js]
        
        SYNC --> PG
        PG --> API
        API --> FE
    end
```

## Consequências

### Positivas ✅

1. **Separação de Responsabilidades**: ETL pesado não impacta performance de consulta
2. **Concorrência**: PostgreSQL lida bem com múltiplos usuários simultâneos
3. **Maturidade**: Backup (`pg_dump`), replicação, monitoramento bem estabelecidos
4. **Ecosistema**: ORMs (SQLAlchemy), connection pooling (PgBouncer), migrações (Alembic)
5. **Custo**: PostgreSQL roda bem em VPS com 2-4GB RAM para workloads moderados
6. **Dados Históricos**: Parquet preservados como "cold storage"

### Negativas ⚠️

1. **Complexidade Adicional**: Pipeline de sincronização extra
2. **Latência de Dados**: Dados no PostgreSQL podem estar desatualizados vs. Parquet local
3. **Duplicação de Storage**: Dados existem em Parquet (ETL) + PostgreSQL (produção)
4. **Performance de Analytics**: PostgreSQL é mais lento que DuckDB para agregações pesadas

### Mitigações

| Problema | Solução |
|----------|---------|
| Latência | Sincronização periódica (diária/semanal) com timestamp de atualização |
| Duplicação | PostgreSQL mantém apenas dados agregados (Gold), não histórico completo |
| Performance | Índices otimizados + views materializadas no PostgreSQL |

## Alternativas Consideradas

### Alternativa 1: DuckDB em Produção (Status Quo)
- **Rejeitada**: Single-writer constraint impede múltiplos usuários com escritas
- **Risco**: Erros de "database locked" em cenários de concorrência

### Alternativa 2: MotherDuck (SaaS)
- **Rejeitada**: Custo adicional (~$250/mês), vendor lock-in
- **Contexto**: Fora do orçamento de projeto acadêmico/TCC

### Alternativa 3: ClickHouse/Druid
- **Rejeitada**: Complexidade operacional alta para VPS básica
- **Contexto**: Over-engineering para volume de dados do projeto

### Alternativa 4: SQLite
- **Rejeitada**: Mesmos problemas de concorrência do DuckDB, performance inferior

## Implementação

### Estrutura de Tabelas PostgreSQL

```sql
-- Dimensões (lentamente mutáveis)
dim_municipio          -- dados cadastrais
dim_tempo              -- calendário, feriados
dim_tipo_veiculo       -- categorias CID-10

-- Fatos (métricas por período)
fato_frota_mensal      -- frota DENATRAN
fato_obitos_mensal     -- óbitos SIM
fato_custos_mensal     -- custos SIA
```

### Script de Sync

```python
# scripts/sync_to_postgres.py
# Lê Parquet Gold → INSERT/UPSERT PostgreSQL
```

### Variáveis de Ambiente

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/transito_sus
ETL_MODE=local          # local: DuckDB/Parquet
PROD_MODE=postgres      # prod: PostgreSQL
```

## Referências

- [DuckDB Production Guide](https://www.dench.com/blog/duckdb-in-production)
- [DuckDB Concurrency Model](https://duckdb.org/docs/connect/concurrency.html)
- [PostgreSQL vs DuckDB for Analytics](https://airbyte.com/data-engineering-resources/duckdb-vs-postgres)

---

**Autor**: Thallys Lemos  
**Data**: 2026-04-05  
**Revisores**: Agentes IA
