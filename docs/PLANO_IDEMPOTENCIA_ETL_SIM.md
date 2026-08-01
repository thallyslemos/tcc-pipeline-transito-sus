# Plano de idempotência e linhagem do ETL SIM

**Data:** 31/07/2026  
**Branch:** `audit/silver-sim-qa`  
**Decisão atual:** corrigir a ingestão antes de reprocessar a Silver ou fechar a Gold.

## Causa reproduzida

Em `data-pipeline/datasus.py`, as funções de streaming:

- criam `sim_parts`/`sia_parts` se o diretório não existir;
- reiniciam `part_idx = 0` a cada chamada;
- nomeiam os arquivos apenas como `sim_{uf}_{ano}_{part_idx}.parquet` ou `sia_{uf}_{ano}_{part_idx}.parquet`;
- pulam somente quando o mesmo nome existe.

O índice global não identifica o arquivo remoto. Se o escopo ou a ordem de UFs/anos muda entre duas execuções, a mesma origem recebe outro índice e uma nova cópia é criada. A Silver, por sua vez, expande `*.parquet` e lê todas as cópias.

Evidência no estado atual:

- 557 partições SIM locais;
- 145 grupos byte a byte repetidos, envolvendo 297 arquivos;
- Bahia: duas cópias por ano em 2010–2019 e três cópias por ano em 2020–2024;
- exemplo: `sim_BA_2020_3`, `_20` e `_70` são idênticos, com 107.194 linhas, 6.134.957 bytes e o mesmo SHA-256.

As saídas fixas `data/silver/sim.parquet` e `data/gold/*.parquet` são sobrescritas; a duplicação observada nasce nas partições Bronze, não nessas saídas.

## Invariantes da correção

1. Uma origem remota identificada por `client + remote_path + fingerprint` produz uma única partição lógica.
2. Repetir a mesma execução não aumenta o número de partições nem de linhas.
3. Alterar escopo ou ordenar UFs/anos não altera a identidade da origem.
4. O arquivo bruto e os campos raw não são modificados.
5. Partição incompleta, corrompida ou com schema divergente não é promovida.
6. A Silver nova lê somente partições aprovadas no manifesto.
7. A Silver atual permanece preservada para comparação e auditoria.

## Entrega em fases

### Fase A — testes RED

Adicionar testes com FakeSIM/FakeSIA para:

- mesma chamada duas vezes;
- mesma origem em escopos diferentes;
- ordem diferente de UF/ano;
- arquivo truncado ou schema incompatível;
- falha durante escrita temporária;
- manifesto incompleto ou com fingerprint divergente.

### Fase B — ingestão determinística

- substituir o contador por chave derivada de sistema, UF, ano e caminho/nome remoto;
- preservar `remote_path`, nome original, tamanho remoto, data de modificação, cliente e hash;
- escrever para um `.tmp` exclusivo;
- validar leitura, schema e contagem com DuckDB;
- promover com `os.replace` somente após validação;
- atualizar o manifesto de forma atômica.

### Fase C — Silver versionada

- selecionar apenas partições aprovadas pelo manifesto;
- preservar `UF` de origem e derivar `uf_ocorrencia`/`uf_residencia` separadamente;
- manter `sexo_raw`, `idade_raw`, `cod_mun_*_raw` e a chave da DO quando disponível;
- gravar em novo destino versionado, por exemplo `data/silver/sim_v2.parquet`;
- comparar contagens deduplicadas com TABNET/consulta oficial antes de qualquer Gold.

### Fase D — decisão de migração

Somente após os testes e a reconciliação:

- decidir se PySUS 2.x entra como cliente de inventário/download;
- decidir se o catálogo PySUS ou DuckLake será mantido como fonte auxiliar;
- documentar uma política explícita de snapshot e atualização;
- deixar qualquer limpeza de arquivos antigos para um comando explícito, com backup e relatório.

## Testes de aceitação

- segunda execução idêntica: zero novas partições;
- execução com ordem/escopo diferente: mesmo conjunto de fingerprints;
- manifesto informa 15 arquivos canônicos BA 2010–2024 quando cruzado com FTP;
- ausência no catálogo PySUS (como 2012 observado na POC) gera alerta, não exclusão silenciosa;
- nenhum `sexo=0/9` recebe rótulo feminino;
- códigos municipais raw permanecem preservados e derivados são testados separadamente;
- `read_parquet` em modo estrito identifica qualquer drift antes de `union`;
- dados originais continuam byte a byte inalterados.
