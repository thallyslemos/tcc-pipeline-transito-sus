# Architecture Decision Records (ADRs)

Este diretório contém os registros de decisões arquiteturais (ADRs) do projeto Pipeline Analítico de Acidentes de Trânsito no SUS.

## Índice de ADRs

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [ADR-001](ADR-001-arquitetura-banco-dados-producao.md) | Arquitetura de Banco de Dados para Produção | Aceito | 2026-04-05 |
| [ADR-002](ADR-002-modelagem-dimensional-geografia.md) | Modelagem Dimensional com Dados Geográficos Desacoplados | Aceito | 2026-04-05 |

## Template de ADR

```markdown
# ADR-XXX: Título da Decisão

## Status

- Proposto
- Aceito
- Rejeitado
- Deprecado
- Substituído por [ADR-YYY]

## Contexto

Descreva o problema, restrições e contexto que levaram à necessidade desta decisão.

## Decisão

Descreva a decisão tomada e sua justificativa.

## Consequências

### Positivas ✅

### Negativas ⚠️

### Mitigações

## Alternativas Consideradas

## Referências

## Notas
```

## Convenções

1. **Numeração sequencial**: ADRs são numerados sequencialmente (001, 002, etc.)
2. **Status claro**: Sempre manter o status atualizado
3. **Data obrigatória**: Data da decisão ou última atualização
4. **Links**: Referenciar ADRs relacionadas quando aplicável

---

Para mais informações sobre ADRs:
- [Documentação Oficial ADR](https://adr.github.io/)
- [Michael Nygard - Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
