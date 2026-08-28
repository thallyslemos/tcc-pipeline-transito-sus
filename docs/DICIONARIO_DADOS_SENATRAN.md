# Dicionário de dados SENATRAN/RENAVAM

## Escopo e fontes

O produto local contém os snapshots municipais de dezembro de 2010 a 2024 publicados pela Secretaria Nacional de Trânsito. A página oficial de estatísticas é usada para descoberta e os arquivos anuais são preservados na Bronze. O catálogo RENAVAM do Portal de Dados dos Transportes funciona como referência complementar de metadados.

Fontes oficiais:

* https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/estatisticas-frota-de-veiculos-senatran
* https://dados.transportes.gov.br/dataset/registro-nacional-de-veiculos-automotores-renavam
* https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/estatisticas/renavam/glossario-da-frota-de-veiculos-estatisticas-denatran/

Os arquivos municipais não fornecem código IBGE. O pareamento usa UF e nome normalizado, seguido exclusivamente de aliases revisados em `data-pipeline/resources/senatran_municipio_aliases.csv`. Similaridade textual pode apoiar revisão, mas nunca promove correspondências automaticamente.

## Camadas e grãos

| Camada | Arquivo | Grão | Linhas |
|---|---|---|---:|
| Bronze | `data/bronze/senatran/AAAA/senatran_frota_AAAA_12_HASH.ext` | arquivo oficial imutável e endereçado por hash | 15 snapshots ativos; versões anteriores são preservadas |
| Silver | `data/silver/senatran_frota_municipio_tipo.parquet` | linha original municipal, ano e tipo SENATRAN | 1.754.718 |
| Gold total | `data/gold/frota_municipio_ano.parquet` | código IBGE de sete dígitos e ano | 83.538 |
| Gold por tipo | `data/gold/frota_municipio_ano_tipo.parquet` | código IBGE de sete dígitos, ano e tipo | 1.754.298 |

A Gold exclui somente agregados sem código municipal e itens explicitamente em quarentena. A Silver conserva essas linhas e o relatório `data/quality/senatran_frota_qa.json` registra seu estado.

## Campos da Silver longa

| Campo | Tipo lógico | Regra |
|---|---|---|
| `cod_mun_ibge` | texto anulável | chave canônica de sete dígitos após pareamento |
| `uf` | texto | sigla da origem SENATRAN |
| `municipio_ibge` | texto anulável | nome canônico da dimensão do projeto |
| `municipio_senatran` | texto | nome bruto preservado da planilha |
| `ano` | inteiro | ano do snapshot |
| `mes_referencia` | inteiro | sempre 12 neste produto anual |
| `competencia` | data | primeiro dia de dezembro do ano de referência |
| `tipo_veiculo_codigo` | texto | identificador normalizado estável |
| `tipo_veiculo_senatran` | texto | rótulo da categoria oficial |
| `quantidade` | inteiro não negativo | veículos registrados |
| `match_status` | enum | `exact`, `alias`, `not_informed`, `quarantined`, `unmatched` ou `ambiguous` |
| `source_sha256` | texto | SHA-256 do arquivo Bronze |
| `source_url` | texto | URL oficial do recurso |
| `page_url` | texto | página anual usada para descoberta |

## Campos adicionais da Gold total

| Campo | Definição |
|---|---|
| `frota_total` | total oficial do município no snapshot de dezembro |
| `AUTOMOVEL` a `UTILITARIO` | 21 categorias publicadas no leiaute municipal |
| `frota_duas_rodas_motorizadas` | `MOTOCICLETA + MOTONETA + CICLOMOTOR` |
| `mes_referencia` | 12 |
| `source_sha256` | hash do snapshot anual correspondente |

O total oficial inclui categorias que não são veículos automotores de uso individual, como reboque e semirreboque. Por isso a taxa geral deve ser chamada de óbitos por 10 mil veículos registrados, e análises específicas devem declarar o subconjunto usado.

## Categorias oficiais presentes

`AUTOMOVEL`, `BONDE`, `CAMINHAO`, `CAMINHAO TRATOR`, `CAMINHONETE`, `CAMIONETA`, `CHASSI PLATAF`, `CICLOMOTOR`, `MICRO-ONIBUS`, `MOTOCICLETA`, `MOTONETA`, `ONIBUS`, `QUADRICICLO`, `REBOQUE`, `SEMI-REBOQUE`, `SIDE-CAR`, `OUTROS`, `TRATOR ESTEI`, `TRATOR RODAS`, `TRICICLO` e `UTILITARIO`.

## Gates de qualidade

Cada ano deve ter 27 UFs, valores inteiros não negativos, unicidade de UF e município na origem, igualdade exata entre `TOTAL` e a soma das 21 categorias e relatório de todos os pareamentos. O snapshot da Bahia deve conter 417 linhas. Qualquer `unmatched` ou `ambiguous` bloqueia a Gold por padrão. `MUNICIPIO NAO INFORMADO` e quarentenas não são atribuídos artificialmente a um município.

O consumo recalcula o SHA-256 e o tamanho da Bronze antes da leitura. A competência de dezembro precisa estar demonstrada pela URL oficial ou pelo nome do membro dentro do pacote, sem inferência pelo ano do arquivo. O QA registra separadamente o hash do pacote e o hash da planilha extraída. Em 2012, essa regra seleciona `Frota Munic.DEZ.2012.xls`; uma implementação anterior confundia o trecho `12` de `2012` com o mês e escolhia agosto. Em 2015, a URL e o membro do RAR identificam dezembro e o hash da planilha extraída é `f982fb730b85a0fdfcb2802f6ffea0748df197574cc35e9828bb6b8d682e0a93`. A aba interna conserva o rótulo legado `JUL_2015`; a divergência fica explicitamente sinalizada no QA e não é usada como competência.

Em 2024 foram reconciliadas 5.573 linhas e 123.974.520 veículos no Brasil. A Bahia apresentou 417 linhas e 5.389.511 veículos. Sete veículos estavam em `MUNICIPIO NAO INFORMADO`, e um registro de `IBITIUVA/SP` foi mantido em quarentena por representar distrito sem correspondência municipal.

## Uso nas taxas e limites de interpretação

A taxa anual implementada é:

```text
óbitos no município e ano / frota registrada no município em dezembro do mesmo ano * 10.000
```

Sem frota municipal do mesmo ano, a API retorna `null` e `frota_status=indisponivel`. Não há interpolação, carregamento do último valor nem substituição por zero.

Quando a consulta SIM é filtrada por categoria da vítima, a taxa geral da API continua usando a frota total registrada. Ela não deve ser interpretada como taxa específica daquela categoria. A taxa exploratória de motociclistas usa outro denominador, declarado como `MOTOCICLETA + MOTONETA + CICLOMOTOR`.

O campo `tipo_veiculo` dos marts SIM representa categoria da vítima derivada da CID-10, enquanto `tipo_veiculo_senatran` representa categoria do veículo registrado. Eles não são dimensões equivalentes. A ponte entre vítimas motociclistas e `MOTOCICLETA + MOTONETA + CICLOMOTOR` é uma escolha analítica explícita para associação ecológica, não identificação causal do veículo envolvido no acidente.

## Execução independente

```bash
uv run python -m data-pipeline.senatran_pipeline \
  --years 2010:2024 \
  --data-root /home/thallys/projetos/tcc-pipeline-transito-sus/data \
  --municipalities-csv /home/thallys/projetos/tcc-pipeline-transito-sus/data/municipios.csv \
  --aliases-csv data-pipeline/resources/senatran_municipio_aliases.csv
```

O arquivo oficial de 2015 é RAR e requer um backend compatível com `rarfile`, como `unrar`, `unrar-free` ou `7z`, no WSL. A execução não faz parte de `data-pipeline.run`; os pipelines SIM e SENATRAN podem ser atualizados e auditados de forma independente. Uma execução parcial substitui somente os anos solicitados e preserva os demais anos já publicados; incompatibilidade de schema ou duplicação de chave bloqueia a escrita.
