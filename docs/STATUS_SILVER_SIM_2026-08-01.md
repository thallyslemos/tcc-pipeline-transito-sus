# Status das etapas — Silver SIM

Branch de trabalho: `audit/silver-sim-qa`.

## Concluido

- Inventario do repositorio, dados locais, layouts e fontes oficiais do SIM.
- Auditoria inicial da Silver legada, incluindo duplicidades, idade, sexo,
  municipios e divergencias UF do arquivo versus ocorrência.
- Radar PySUS 2.x/DuckLake em POC isolada, sem atualizar o ambiente do ETL.
- Ingestao streaming com identidade baseada em cliente/grupo/caminho remoto,
  manifesto atomico, escrita temporaria, validacao e deteccao de drift.
- Testes de reexecucao, ordem/escopo, colisao de alvo, wrapper PySUS 2.x e
  falha atomica.
- Silver v2 raw-preserving, com `qa_status`, `record_id`, CID explicito,
  idade versionada, sexo ignorado, geografia de residencia/ocorrencia e
  linhagem por arquivo.
- Manifesto canonico BA 2010–2024 e artefato local
  `data/silver/sim_v2_ba_2010_2024.parquet`.
- Relatorio de validacao com reconciliacao temporal e ancoras oficiais.
- Suite completa do repositorio: 87 passed, 6 skipped.

## Ainda bloqueado por decisao metodologica (nao por falha tecnica)

- Gold cientifica: precisa declarar se o denominador municipal sera residencia
  ou ocorrência e filtrar `is_v01_v89` explicitamente.
- Benchmark oficial: reproduzir TABNET com snapshot, conteúdo, linha, coluna,
  filtro CID e universo fetal/não fetal registrados.
- Ocorrência estadual BA: reunir todas as UFs ou consultar TABNET por
  ocorrência; os arquivos `DORES` de BA não bastam.
- Migração para PySUS 2.x/DuckLake: manter como decisão posterior, após
  adapter FTP testado e política de snapshots aprovada.

