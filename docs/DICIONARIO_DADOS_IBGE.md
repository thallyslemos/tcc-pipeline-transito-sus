# Dicion?rio de dados IBGE

## Estado local auditado em 2026-08-01

| Artefato | Gr?o | Cobertura observada | Situa??o |
|---|---|---:|---|
| `data/municipios.csv` | munic?pio | 5.571 c?digos ?nicos, sete d?gitos | cadastro mais completo local; origem/data ainda precisam entrar no manifesto |
| `data/ibge_municipios.parquet` | munic?pio | 5.537 c?digos, 27 UFs | nomes/UF/regi?o completos; `lat`/`lon` nulos em 100% das linhas; subconjunto dirigido pelos dados |
| `data/ibge_populacao.parquet` | munic?pio-ano | 49.206 chaves; anos 2011?2021 e 2024 | valores positivos, por?m cobertura municipal parcial; 2010, 2022 e 2023 ausentes |
| `data/ibge_malhas_municipios.geojson` | geometria municipal | 5.571 features, 5.554 Polygon e 17 MultiPolygon | geometria v?lida; fonte cartogr?fica principal |

## Campos

- `cod_mun_ibge`: c?digo oficial como texto; preservar zeros ? esquerda.
- `nome`, `uf`, `regiao`: atributos da dimens?o municipal.
- `lat`, `lon`: centroides opcionais (`DOUBLE` quando dispon?veis); n?o s?o requisito de visualiza??o.
- `ano`, `populacao`: denominador populacional exato do ano.
- GeoJSON `codarea`: chave de sete d?gitos usada no v?nculo com a dimens?o.

A URL de metadados de malha foi corrigida para usar o c?digo solicitado. Mesmo assim, nenhum c?lculo cient?fico depende de centroides. O job IBGE prefere o Silver SIM v2 final e n?o mistura SIA para inferir munic?pios.

A popula??o deve ser consultada por munic?pio/ano e gravada com fonte, data de refer?ncia, hash e status de disponibilidade. Aus?ncia deve ser exibida como `indisponivel`; n?o usar os valores aproximados legados de `data-pipeline/ibge.py` em evid?ncia cient?fica.
