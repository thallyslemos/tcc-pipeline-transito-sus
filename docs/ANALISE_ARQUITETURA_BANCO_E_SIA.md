# Análise Profunda: Alternativas ao PostgreSQL e Campos Financeiros do SIA

## Parte 1: Por que PostgreSQL vs Alternativas para a Camada Gold

### Resumo Executivo

Após análise aprofundada das alternativas, **PostgreSQL permanece como a melhor escolha** para nossa camada de consumo em produção, considerando o contexto de VPS básica, multi-usuários e workload analítico com necessidades transacionais.

---

### Alternativas Analisadas

#### 1. SQLite

**Arquitetura**: Embedded, serverless, single-file

| Aspecto | SQLite | PostgreSQL |
|---------|--------|------------|
| **Concorrência** | ❌ Single-writer (mesmo problema do DuckDB) | ✅ Multi-writer MVCC |
| **Escalabilidade** | Vertical apenas | Horizontal com replicação |
| **Tamanho máximo** | ~280 TB (teórico), mas performance degrada | Ilimitado |
| **Backup** | Copiar arquivo | pg_dump, PITR, streaming replica |
| **Ecosistema ORM** | Limitado | SQLAlchemy, Django, etc. |

**Por que não usar SQLite em produção:**
- Mesma limitação do DuckDB: **apenas um escritor por vez**
- File-level locking pode causar timeouts em escritas concorrentes
- Sem user management granular (GRANT/REVOKE)
- Sem replicação nativa (precisaria de Litestream/Turso)
- Risco de corrupção em crashes durante writes

**Quando SQLite funciona:**
- Aplicações mobile/desktop
- Edge computing (com Turso/Cloudflare D1)
- Testes e CI/CD
- Read-heavy com single process writer

**Veredicto**: ❌ **Inadequado** - Mesmos problemas de concorrência do DuckDB

---

#### 2. ClickHouse

**Arquitetura**: Colunar, distribuído, OLAP puro

| Aspecto | ClickHouse | PostgreSQL |
|---------|------------|------------|
| **Performance OLAP** | ⭐⭐⭐⭐⭐ Excepcional | ⭐⭐⭐ Boa com índices |
| **INSERTs** | ⭐⭐⭐⭐⭐ Batch extremamente rápido | ⭐⭐⭐ Moderado |
| **UPDATE/DELETE** | ❌ Muito lento (mutations async) | ✅ Rápido |
| **JOINs complexos** | ⭐⭐⭐ Limitado | ⭐⭐⭐⭐⭐ Excelente |
| **MVCC/ACID** | ❌ Eventual consistency | ✅ Full ACID |
| **Operational overhead** | Alto (Keeper/ZooKeeper) | Médio |

**Por que não usar ClickHouse:**
- Over-operacional para VPS básica
- Requer cluster management (ZooKeeper/Keeper)
- Não suporta UPDATE/DELETE eficiente (trabalho é append-only)
- Excesso de capacidade para volume de dados do projeto

**Quando ClickHouse brilha:**
- Billions de eventos por dia
- Real-time analytics com sub-second latency
- Time-series em escala massiva

**Veredicto**: ❌ **Overkill** - Complexidade não justifica para nosso volume

---

#### 3. TimescaleDB

**Arquitetura**: Extensão PostgreSQL para time-series

| Aspecto | TimescaleDB | PostgreSQL |
|---------|-------------|------------|
| **Time-series queries** | ⭐⭐⭐⭐⭐ Hypertables, continuous aggregates | ⭐⭐⭐ Requer índices manuais |
| **Compressão** | ⭐⭐⭐⭐⭐ Colunar em chunks antigos | ⭐⭐ TOAST limitado |
| **SQL padrão** | ✅ Sim | ✅ Sim |
| **Ecossistema** | ✅ PostgreSQL completo | ✅ PostgreSQL completo |
| **Instalação** | Extensão extra | Nativo |

**Considerações:**
- TimescaleDB é uma **extensão PostgreSQL**, não um banco separado
- Hypertables são ideais para dados temporais (nosso caso!)
- Continuous aggregates = views materializadas automáticas
- Compressão nativa pode reduzir storage em 90%+

**Veredicto**: ✅ **Promissor** - Podemos considerar para fase 2

---

#### 4. DuckDB (em produção)

**Arquitetura**: Embedded colunar OLAP

| Aspecto | DuckDB Produção | PostgreSQL |
|---------|-----------------|------------|
| **Concorrência reads** | ✅ Múltiplos readers | ✅ Múltiplos readers |
| **Concorrência writes** | ❌ Single-writer | ✅ Multi-writer |
| **Setup** | Zero-config | Requer setup |
| **Tamanho** | Single-node | Ilimitado |
| **MotherDuck** | SaaS opcional | Self-hosted |

**Por que não DuckDB em produção multi-user:**
- File-level locking impede múltiplos writers
- Sem user authentication nativo
- Sem backup/replicação nativos
- Sem connection pooling

**Veredicto**: ❌ **Inadequado** - Mantido apenas para ETL

---

### Decisão Arquitetural Atualizada

```
ETL Local                    Produção VPS
┌─────────────┐              ┌─────────────────┐
│ DuckDB      │──Sync──▶     │ PostgreSQL      │
│ (processar) │              │ (multi-user)    │
└─────────────┘              └─────────────────┘
                                    │
                              ┌─────┴─────┐
                              │  Opcional │
                              │TimescaleDB│
                              │(fase 2)   │
                              └───────────┘
```

**Razões para manter PostgreSQL:**
1. ✅ Maturidade operacional (backup, monitoramento, replicação)
2. ✅ MVCC real para multi-usuários concorrentes
3. ✅ Ecosistema ORM completo (SQLAlchemy)
4. ✅ Roda bem em VPS com 2-4GB RAM
5. ✅ Possibilidade de migração para TimescaleDB futuramente
6. ✅ Full ACID compliance

**Quando reconsiderar:**
- Se volume ultrapassar 100GB+ com queries lentas → TimescaleDB
- Se necessário real-time sub-second → ClickHouse
- Se edge computing → SQLite + Turso

---

## Parte 2: Entendendo os Campos Financeiros do SIA

### Análise dos Campos PA_QTDPRO, PA_QTDAPR, PA_VALPRO, PA_VALAPR

Baseado no **Informe Técnico SIASUS 2019/07** e pesquisas adicionais:

#### Definições Oficiais

| Campo | Nome Técnico | Descrição |
|-------|--------------|-----------|
| `PA_QTDPRO` | Quantidade Produzida (Apresentada) | Quantidade declarada pelo estabelecimento |
| `PA_QTDAPR` | Quantidade Aprovada | Quantidade aprovada pelo SUS após críticas |
| `PA_VALPRO` | Valor Produzido (Apresentado) | Valor calculado sobre QTDPRO × valor unitário |
| `PA_VALAPR` | Valor Aprovado | Valor aprovado para pagamento (QTDAPR × valor unitário) |

#### O Que Isso Significa na Prática

```
Fluxo de Processamento SIA:

1. Estabelecimento declara:
   - Procedimento: Consulta Médica (0301010072)
   - Quantidade: PA_QTDPRO = 100
   - Valor unitário SIGTAP: R$ 50,00
   - PA_VALPRO = 100 × 50 = R$ 5.000,00

2. SUS processa e aplica críticas:
   - Quantidade aprovada: PA_QTDAPR = 95 (5 rejeitados por inconsistência)
   - PA_VALAPR = 95 × 50 = R$ 4.750,00

3. Resultado:
   - QTDPRO (100) ≠ QTDAPR (95)
   - VALPRO (5000) ≠ VALAPR (4750)
```

#### Regra de Ouro para Cálculos

**✅ SEMPRE usar PA_VALAPR para análises financeiras**

Razões:
1. PA_VALAPR representa o valor **efetivamente aprovado para pagamento**
2. PA_VALPRO pode conter valores rejeitados/inconsistentes
3. Estudos do TCU e literatura acadêmica usam PA_VALAPR

**⚠️ NUNCA multiplicar PA_QTDAPR × valor unitário manualmente**

O campo PA_VALAPR já contém o valor correto calculado pelo SUS, considerando:
- Valor unitário do procedimento na tabela SIGTAP
- Ajustes por porte do estabelecimento
- Incrementos (urgência, complexidade)
- Valor do complemento federal/local

#### Exemplo de Inconsistência Encontrada na Literatura

Do TCU (Tribunal de Contas da União):
> "A variável PA_QTDPRO trata da quantidade produzida declarada pelo estabelecimento. PA_QTDAPR, por sua vez, é a quantidade aprovada com base no parâmetro anterior... **A utilização de PA_QTDAPR é mais apropriada** por ela ter a informação já aprovada pelo SUS."

#### Quando QTDPRO ≠ QTDAPR

Situações comuns de rejeição:
- Procedimento não programado na FPO
- Inconsistência de idade/sexo com o procedimento
- Duplicidade de atendimento
- Estabelecimento não habilitado para o procedimento
- Erro de digitação no CNS do paciente

#### Para Análise de Custos em Acidentes de Trânsito

```sql
-- Query correta para custos SIA
SELECT 
    PA_MUNPCN as cod_municipio,
    YEAR(PA_CMP) as ano,
    MONTH(PA_CMP) as mes,
    SUM(PA_VALAPR) as custo_total,      -- ✅ Correto
    SUM(PA_QTDAPR) as qtd_procedimentos, -- ✅ Correto
    COUNT(*) as qtd_atendimentos
FROM sia_pa
WHERE LEFT(PA_CIDPRI, 3) BETWEEN 'V01' AND 'V89'  -- CID-10 acidentes
GROUP BY PA_MUNPCN, YEAR(PA_CMP), MONTH(PA_CMP);

-- ❌ INCORRETO - Não fazer:
-- SUM(PA_QTDAPR * valor_unitario)  
-- SUM(PA_VALPRO)
```

---

## Parte 3: Outras Tabelas do SIA para Considerar

### Tabela de Subsistemas APAC

O SIA possui múltiplas tabelas além do PA (Procedimentos Ambulatoriais):

| Sigla | Nome | Arquivo | Registros (aprox) | Relevância para Trânsito |
|-------|------|---------|-------------------|--------------------------|
| **PA** | Procedimentos Ambulatoriais | PAUFAAMM.DBF | 8 bilhões+ | ⭐⭐⭐⭐⭐ Principal |
| **BI** | BPA Individualizado | BIUFAAMM.DBF | 1.8 bilhão | ⭐⭐⭐⭐⭐ Principal |
| **AD** | Laudos Diversos | ADUFAAMM.DBF | 42 milhões | ⭐⭐⭐ CID detalhado |
| **AM** | Medicamentos | AMUFAAMM.DBF | 237 milhões | ⭐⭐ Medicamentos pós-acidente |
| **AQ** | Quimioterapia | AQUFAAMM.DBF | 42 milhões | ⭐ Pouco relevante |
| **AR** | Radioterapia | ARUFAAMM.DBF | 3.3 milhões | ⭐ Pouco relevante |
| **AN** | Nefrologia | ANUFAAMM.DBF | 6.5 milhões | ⭐⭐ Lesão renal traumática? |
| **ATD** | Tratamento Dialítico | ATDUFAAMM.DBF | 9.7 milhões | ⭐⭐ Lesão renal traumática? |

### Análise de Potencial

#### 1. Laudos Diversos (AD) - RECOMENDADO

**O que contém:**
- APACs de procedimentos de alta complexidade
- Detalhamento clínico mais profundo
- Campos específicos por tipo de atendimento

**Campos relevantes:**
```
AP_CIDPRI    - CID Principal (mais detalhado que PA)
AP_CIDSEC    - CID Secundário
AP_CIDCAS    - CID Causas Associadas
AP_DTINIC    - Data início tratamento
AP_DTFIM     - Data fim tratamento
AP_TPATEN    - Tipo de atendimento
```

**Por que incluir:**
- ✅ Maior granularidade clínica
- ✅ Permite análise de sequelas
- ✅ Tempo de tratamento (reabilitação)
- Volume gerenciável (42M registros vs 8B do PA)

#### 2. Medicamentos (AM) - OPCIONAL

**O que contém:**
- Prescrição de medicamentos de alto custo
- Dados de pacientes em tratamento contínuo

**Campos específicos:**
```
AM_PESO      - Peso do paciente
AM_ALTURA    - Altura
AM_TRANSPL   - Indicador de transplante
AM_QTDTRAN   - Quantidade de transplantes
AM_GESTANT   - Gestante
```

**Potencial para trânsito:**
- Medicamentos para dor crônica pós-trauma?
- Reabilitação prolongada?
- ⚠️ Requer análise se há correlação com CID V01-V89

**Recomendação:** 
> Analisar amostra primeiro. Se <5% dos registros AM têm CID relacionado a acidentes, **não justifica** a complexidade.

#### 3. Nefrologia (AN) e Diálise (ATD) - OPCIONAL

**Potencial:**
- Lesão renal traumática em acidentes graves?
- Insuficiência renal aguda pós-trauma?

**Volume:** Baixo (6-10M registros)

**Recomendação:**
> Verificar se há correlação significativa com traumas. Provavelmente **não prioritário**.

### Sugestão de Escopo

**Fase 1 (MVP):**
- ✅ PA (Procedimentos Ambulatoriais) - Principal
- ✅ BI (BPA Individualizado) - Principal

**Fase 2 (Enriquecimento):**
- 🔍 AD (Laudos Diversos) - Análise de sequelas
- 🔍 DENATRAN (Frota) - Para taxas por veículo

**Fase 3 (Opcional):**
- 🔍 AM (Medicamentos) - Se houver correlação relevante
- 🔍 IBGE (PIB, IDH) - Contexto socioeconômico

---

## Referências

1. Informe Técnico SIASUS 2019/07 - DATASUS
2. TCU - Detecção de Anomalias nos Dados de Produção Ambulatorial (2020)
3. UFMG - Estudo de Caso em Data Warehouse sobre o SIA (2012)
4. DuckDB vs PostgreSQL: Production Considerations (2024)
5. ClickHouse vs TimescaleDB: Architecture Comparison (2025)

---

**Conclusão:**
- ✅ PostgreSQL mantido para produção
- ✅ Usar sempre PA_VALAPR (nunca PA_VALPRO)
- ✅ Considerar tabela AD (Laudos Diversos) na Fase 2
- ⚠️ Avaliar correlação das demais tabelas APAC antes de incluir
