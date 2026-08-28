# OpenSpec (convenção mínima)

Este repositório não usa a pasta `openspec/` da ferramenta homónima. A convenção
aqui é **especificar antes de alterar contratos** e rastrear requisitos em
[SPEC.md](SPEC.md).

## Fonte de requisitos

- [docs/SPEC.md](SPEC.md): capacidades, endpoints e critérios de aceite.
- [docs/ARCHITECTURE.md](ARCHITECTURE.md): decisões técnicas e diagramas.
- [docs/PIPELINE_ETL.md](PIPELINE_ETL.md): camadas Medallion e semântica dos Parquets.

## Fluxo

1. **Especificar**: atualizar `SPEC.md` (e, se aplicável, `MODELAGEM_DADOS.md`)
   quando mudar contrato da API, schema de consumo ou semântica de dados.
2. **Implementar**: código, migrações SQL e variáveis de ambiente alinhados à
   especificação.
3. **Validar**: `uv run pytest tests/ -v`, `uv run ruff check .` e checklist do
   próprio PR (dados de exemplo vs produção).

## Critérios de aceite

Os critérios por capacidade estão descritos em `SPEC.md`. Mudanças que quebrem
um critério exigem atualização explícita da spec ou rejeição do escopo.

## ADRs

Decisões arquiteturais duradouras ficam em [docs/adr/](adr/).
