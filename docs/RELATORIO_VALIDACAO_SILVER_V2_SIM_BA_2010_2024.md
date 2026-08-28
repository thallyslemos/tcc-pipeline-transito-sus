# Validacao da Silver v2 do SIM — Bahia, 2010–2024

Data da execucao: 2026-08-01. A validacao foi executada localmente, sem
publicacao e sem sobrescrever `data/silver/sim.parquet` ou qualquer Parquet
Bronze.

## Escopo e proveniencia

- Fonte local: `data/bronze/sim_parts/`.
- Universo operacional: arquivos `DORES` da UF BA, portanto o arquivo e
  organizado pela residencia declarada; ele nao representa todos os obitos
  ocorridos fisicamente na Bahia.
- Periodo: 2010–2024, 15 hashes de conteudo distintos.
- Arquivos observados: 35; copias redundantes: 20 (duas copias por ano em
  2010–2019 e tres por ano em 2020–2024).
- Manifesto auditavel: `docs/audits/sim_ba_2010_2024_manifest.json`.
- Artefato derivado local: `data/silver/sim_v2_ba_2010_2024.parquet` (nao
  versionado pelo Git).

A deduplicacao foi feita somente por hash de conteudo do arquivo. Nenhuma
linha foi deduplicada por campos da declaracao de obito; o `record_id` usa o
hash do arquivo e a posicao da linha no arquivo.

## Perfil observado

| Verificacao | Resultado |
|---|---:|
| Linhas Bronze canonicas | 1.388.858 |
| Linhas com `is_v01_v89 = true` | 37.775 |
| `record_id` distintos | 1.388.858 |
| Data minima / maxima | 2010-01-01 / 2024-12-31 |
| Sexo ignorado (`0` ou `9`) | 876 |
| Sexo rotulado feminino quando raw ignorado | 0 |
| Municípios de ocorrência sem join IBGE | 132 |
| Municípios de residência sem join IBGE | 6.133 |
| Divergência UF do arquivo × UF de ocorrência | 24.587 |
| Códigos de idade `9`/ignorados | 3.717 |
| Idades acima de 120 anos | 9 |
| Datas inválidas | 0 |

O domínio de sexo foi preservado como `Masculino`, `Feminino` e `Ignorado`;
`0`, `9` e `I` não são tratados como feminino. A idade raw, unidade e
quantidade continuam disponíveis; a conversao usa a tabela versionada
`sim_def_cnv_legacy_0_5` e deixa o código `9` como nulo/ignorado. Os nove
valores acima de 120 anos permanecem sinalizados para revisão, não são
apagados nem truncados.

## ATT por ano no arquivo de residencia BA

Contagem de registros não fetais com causa básica `V01–V89` (o campo
`TIPOBITO` observado foi `2` em todas as linhas desta visão):

| Ano | ATT |
|---:|---:|
| 2010 | 2.593 |
| 2011 | 2.630 |
| 2012 | 2.854 |
| 2013 | 2.666 |
| 2014 | 2.737 |
| 2015 | 2.265 |
| 2016 | 2.389 |
| 2017 | 2.330 |
| 2018 | 2.112 |
| 2019 | 2.314 |
| 2020 | 2.311 |
| 2021 | 2.345 |
| 2022 | 2.441 |
| 2023 | 2.747 |
| 2024 | 3.041 |

Esses números são um perfil do snapshot local e não devem ser tratados como
uma verdade fixa entre publicações. Como referências independentes, o RAG
SESAB 2024 informa 2.673 ATT de residentes em 2024 e 2.754 em 2023, com SIM
atualizado em 10/01/2025; o boletim SESAB de 2019 informa 2.862 em 2012 e
2.330 em 2017. As diferenças são compatíveis com revisão de snapshot,
extração e critérios de publicação; 2023 e 2017 oferecem uma checagem de
sanidade forte, enquanto 2024 exige registrar a versão antes de fixar um
benchmark.

## Residência e ocorrência

`CODMUNRES` foi mantido como residência habitual e `CODMUNOCOR` como local
físico da ocorrência. O join municipal usa a chave de seis dígitos observada
no extrato e a dimensão IBGE, sem aplicar `zfill` cego. A UF do arquivo ficou
em `uf_arquivo`; `uf_residencia` e `uf_ocorrencia` são derivadas da dimensão.

Não é válido comparar diretamente a contagem acima, baseada nos arquivos de
residência BA, com o número de ocorrência estadual. Para uma série de
ocorrência na Bahia será necessário reunir todas as UFs e filtrar
`uf_ocorrencia = 'BA'`, ou reproduzir a consulta TABNET por ocorrência. O
boletim SESAB 2024 publica 2.723 ocorrências em 2023 e o infográfico SEI 2025
publica 2.993 vítimas fatais em 2024; são âncoras de outro universo/snapshot.

## Decisão de liberação

1. A Gold científica ainda não deve consumir `data/silver/sim.parquet`; deve
   receber explicitamente `sim_v2_ba_2010_2024.parquet` e filtrar
   `is_v01_v89` com o conceito geográfico rotulado (residência ou ocorrência).
2. O manifesto e os flags QA estão prontos para uma etapa de reconciliação
   TABNET versionada. A tolerância deve ser diagnóstica, nunca uma correção
   silenciosa de contagem.
3. O pacote PySUS 2.x/DuckLake permanece em POC isolada; a ingestão atual foi
   mantida no cliente FTP legado e agora tem identidade determinística,
   escrita atômica e detecção de drift.

## Fontes oficiais consultadas

- [Apresentacao oficial do SIM — SVSA/MS](https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/apresentacao/)
- [Documentacao oficial do SIM — SVSA/MS](https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/documentacao/)
- [Arquivos DEF/CNV do SIM (`tabdo.zip`)](https://svs.aids.gov.br/download/SIM/DEF_CNV/)
- [Dicionario SIM DO (release anterior)](https://svs.aids.gov.br/download/Dicionario_de_Dados_SIM_tabela_DO.pdf)
- [Dicionario SIM DO (release 07/2025)](https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/documentacao/dicionario-de-dados-SIM-tabela-DO.pdf)
- [Manual de instrucoes da Declaracao de Obito](https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/documentacao/declaracao-obito-manual-instrucoes-preenchimento.pdf)
- [RAG SESAB 2024](https://www.ba.gov.br/saude/sites/site-sesab/files/migracao_2024/arquivos/wp-content/uploads/2025/10/RAG-2024-versao-final.pdf)
- [Boletim SESAB de Acidente de Transporte Terrestre 2019](https://www.saude.ba.gov.br/wp-content/uploads/2017/11/2019-Boletim-de-Acidente-de-Transporte-Terrestre-Cen%C3%A1rio-Bahia.pdf)
- [Boletim SESAB ATT 2024](https://www.ba.gov.br/saude/sites/site-sesab/files/migracao_2024/arquivos/wp-content/uploads/2017/11/boletinATT_No1_2024.pdf)
- [Infografico SEI ATT 2025](https://www.ba.gov.br/sei/sites/site-sei/files/migracao_2024/arquivos/images/publicacoes/infograficos/acidente_de_transito_2025.pdf)
- [PySUS README](https://github.com/AlertaDengue/PySUS)
