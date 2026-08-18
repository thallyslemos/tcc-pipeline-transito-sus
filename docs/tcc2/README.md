# Dossiê de escrita do TCC II

Este diretório reúne o corpus de referência, o protocolo analítico, o registro de resultados e a primeira versão do artigo. Os documentos foram separados para impedir que resultados exploratórios sejam incorporados ao manuscrito como conclusões confirmadas.

| Documento | Finalidade |
|---|---|
| `INVENTARIO_ARTEFATOS_TCC2.md` | Localizar e priorizar versões do TCC I, correções, normas, pesquisas, bases, código e conversas anteriores. |
| `PROMPT_MESTRE_ESCRITA_TCC2.md` | Preservar a intenção científica, a voz do autor, as restrições de estilo e o processo de validação. |
| `DIARIO_METODOLOGICO_TCC2.md` | Registrar fontes, filtros, hashes, consultas, decisões e limitações de cada execução. |
| `REGISTRO_DESCOBERTAS_TCC2.md` | Distinguir resultados confirmados, hipóteses exploratórias e achados excluídos. |
| `MANUSCRITO_TCC2_V1.md` | Servir como primeira versão integrada do artigo, ainda sujeita à análise espacial e temporal definitiva. |
| `RESULTADOS_EDA_BAHIA_FROTA_FLUXOS_TCC2.md` | Registrar a rodada de consultas SIM–IBGE–SENATRAN, a semântica dos fluxos, as anomalias e a paridade API–DuckDB. |

O código reproduzível e os resultados tabulares ficam em `analysis/tcc2`. O manuscrito somente deve receber números classificados como confirmados no registro de descobertas. Resultados municipais baseados em taxas brutas, quebras abruptas ou contagens pequenas exigem auditoria específica e, quando aplicável, suavização ou agrupamento temporal.

## Ordem recomendada de leitura

Para retomar o trabalho com segurança, a sequência é inventário, prompt mestre, diário metodológico, registro de descobertas e manuscrito. Em seguida devem ser lidos o contrato de evidência do SIM e os relatórios de auditoria citados no inventário.

## Execução da rodada atual no WSL

```bash
cd /home/thallys/projetos/tcc-pipeline-transito-sus

/home/thallys/projetos/tcc-pipeline-transito-sus/.venv/bin/python \
  analysis/tcc2/run_eda_sim_bahia.py \
  --data-root /home/thallys/projetos/tcc-pipeline-transito-sus/data \
  --population-path /home/thallys/projetos/tcc-pipeline-transito-sus-tcc2/outputs/tcc2/ibge_populacao/ibge_populacao_municipal_tcc2.parquet \
  --sql analysis/tcc2/eda_bahia_frota_fluxos_v2.sql \
  --output-dir outputs/tcc2/eda_bahia_frota_fluxos_v2

PYTHONPATH=. GOLD_DIR=/home/thallys/projetos/tcc-pipeline-transito-sus/data/gold \
  /home/thallys/projetos/tcc-pipeline-transito-sus/.venv/bin/python \
  analysis/tcc2/validate_tool_effectiveness.py
```

Os CSVs de saída e o manifesto são artefatos locais de execução. O manuscrito usa somente os valores registrados no relatório e no registro de descobertas.

## Estado desta versão

A versão atual fecha o levantamento dos artefatos, estabelece o universo analítico do SIM, reconcilia Silver e Gold, prepara denominadores oficiais do IBGE e incorpora a Gold auditada da SENATRAN como dimensão complementar. A nova EDA cruza residência, ocorrência, população e estoque de veículos, identifica fluxos municipais e registra hipóteses sobre Gavião e Barreiras. A análise espacial confirmatória, a estimação formal de tendências, a reconciliação do denominador de 2023, a revisão bibliográfica sistematizada e a composição final de tabelas e figuras permanecem como etapas antes da submissão.
