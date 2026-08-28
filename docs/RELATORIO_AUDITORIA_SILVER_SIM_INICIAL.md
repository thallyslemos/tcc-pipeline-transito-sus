# Auditoria inicial da camada Silver do SIM

**Escopo científico:** mortalidade por acidentes de transporte terrestre, Bahia, 2010–2024, escala municipal.  
**Data da execução:** 31/07/2026.  
**Decisão:** **Silver bloqueada para análise científica e para fechamento da Gold.**

## Síntese executiva

A Silver atual não demonstra o grão esperado de uma linha por Declaração de Óbito. As partições Bronze da Bahia estão repetidas byte a byte: duas cópias por ano em 2010–2019 e três cópias por ano em 2020–2024. A transformação lê todas as cópias por curinga e as materializa na Silver.

Esse problema explica a quebra artificial da série em 2020 e invalida contagens, taxas, tendências, rankings e análises espaciais produzidas a partir da Silver e da Gold atuais. Nenhum dado original foi removido ou alterado durante esta auditoria.

## Inventário técnico

- Repositório operacional: `tcc-pipeline-transito-sus`.
- Transformação Bronze → Silver: `data-pipeline/silver.py`.
- Silver auditada: `data/silver/sim.parquet`.
- Bronze utilizado: `data/bronze/sim_parts/*.parquet`.
- Dimensão municipal: `data/ibge_municipios.parquet`.
- Dicionário encontrado: `docs/Estrutura_do_SIM_2025.md`.
- Documentos de apoio: `docs/BUG_CONTAMINACAO_UF_SIM.md` e `docs/PAC_AUDITORIA_SIM_SIA.md`.
- Não foram encontrados leiautes oficiais versionados para cada ano de 2010–2024 nem manifesto de origem com URL, data de obtenção e checksum.

## Achados

### Crítico — duplicação do grão

- A Silver contém 777.342 linhas.
- Os arquivos Bronze da Bahia têm SHA-256 idêntico dentro de cada UF/ano:
  - 2010–2019: duas cópias de cada arquivo;
  - 2020–2024: três cópias de cada arquivo.
- A contagem de registros V01–V89 dos arquivos com `UF='BA'` varia de 4.224 a 5.708 em 2010–2019, sobe para 6.933 em 2020 e chega a 9.123 em 2024. O salto coincide exatamente com a passagem de duas para três cópias.
- Risco: superestimação sistemática e mudança de nível artificial da série.
- Correção mínima: impedir colisões de identidade na ingestão, criar manifesto por arquivo-fonte e rejeitar SHA-256 repetido antes da Silver. O reprocessamento deve escrever em um destino versionado novo, nunca sobre os arquivos existentes.

### Alto — identidade da declaração foi descartada

A Silver retém apenas causa, data, municípios, sexo, idade e derivados. Não preserva `NUMERODO`, chave equivalente ou identificador técnico da origem. Assim, depois da transformação não é possível provar unicidade por Declaração de Óbito; registros legitimamente semelhantes ficam indistinguíveis de duplicatas.

### Alto — idade desconhecida é convertida em valor analítico

A regra atual converte falha de conversão para zero e classifica qualquer valor não coberto pelas faixas como `65+`. Foram observadas 4.382 idades acima de 120 anos e 1.749 idades iguais a zero na Silver repetida. Valores desconhecidos e unidades especiais precisam permanecer nulos ou explicitamente classificados, nunca silenciosamente convertidos em recém-nascidos ou idosos.

### Alto — sexo ignorado/desconhecido é rotulado como feminino

Foram observados 375 registros com sexo `0` e 49 com sexo `9`, todos rotulados como “Feminino”. A descrição deve preservar `Masculino`, `Feminino`, `Ignorado` e `Não informado` segundo o domínio oficial aplicável.

### Alto — geografia mistura UF do arquivo e dimensão analítica

- 40.724 linhas (5,24%) têm UF do arquivo divergente do prefixo do município de ocorrência.
- 73 linhas não encontram município de ocorrência na dimensão IBGE.
- 5.939 linhas não encontram município de residência na dimensão IBGE.
- A Silver contém 86.467 linhas cujo município de ocorrência começa por `29` e 88.435 cujo município de residência começa por `29`; esses valores ainda incluem as duplicações.

Devem existir `uf_arquivo`, `uf_ocorrencia` e `uf_residencia` independentes. O recorte Bahia do artigo deve ser explicitamente calculado a partir da dimensão geográfica escolhida, não do campo `UF` de origem.

### Médio — CID-10 e datas passam nos testes sintáticos atuais

- Nenhum `cid_grupo` ficou fora de V01–V89.
- Nenhum código falhou no padrão sintático aplicado.
- Não houve data nula, futura ou perda por falha de conversão entre o filtro V01–V89 do Bronze atual e a Silver.

Isso valida apenas a implementação do filtro sintático atual. Ainda falta reconciliar o conceito epidemiológico e os totais deduplicados com TABNET usando o mesmo eixo geográfico, período e estado de atualização.

### Alto — correspondência oficial incompleta

O projeto possui um documento de estrutura de 2025, mas ainda não demonstra a correspondência campo oficial → coluna Silver → transformação para todo o período 2010–2024. Também faltam:

- versão e URL oficial de cada leiaute;
- domínios anuais de valores especiais;
- evidência sobre mudanças de tamanho dos códigos municipais;
- definição e preservação da chave da DO;
- manifesto dos DBC/Parquet de origem;
- checksum e data de ingestão por arquivo.

## Critérios de liberação

A Silver somente deve ser liberada após:

1. inventário e manifesto imutável das fontes;
2. deduplicação por identidade de arquivo na ingestão;
3. preservação da chave da DO e metadados de linhagem;
4. correção de idade e sexo sem imputação silenciosa;
5. geografia de residência e ocorrência separada e reconciliada com IBGE;
6. reprocessamento para um caminho versionado novo;
7. testes automatizados de unicidade, domínio, cobertura e integridade;
8. reconciliação anual Bahia 2010–2024 com uma consulta oficial independente.

## Entrega semanal proposta

### Semana 1

- inventário versionado de arquivos, hashes, schemas e fontes;
- relatório inicial de qualidade;
- utilitário reproduzível de auditoria somente leitura;
- decisão formal de bloqueio da Silver atual.

### Semana 2

- contrato Silver SIM v1;
- matriz de correspondência oficial;
- testes RED para duplicação, identidade da DO, idade, sexo e geografia;
- implementação corrigida em destino versionado;
- reconciliação com TABNET antes de qualquer Gold.
