# Dicionario de dados IBGE

## Inventario local

| Artefato | Grao | Cobertura observada | Situacao |
|---|---|---|---|
| `data/municipios.csv` | municipio | 5.571 codigos unicos de sete digitos | cadastro local mais completo; origem e data devem constar no manifesto |
| `data/ibge_municipios.parquet` | municipio | 5.537 codigos, 27 UFs | nomes, UF e regiao; lat/lon nulos no snapshot auditado |
| `data/ibge_populacao.parquet` | municipio-ano | 49.206 chaves; anos 2011-2021 e 2024 | valores positivos, cobertura municipal parcial; 2010, 2022 e 2023 ausentes |
| `data/ibge_malhas_municipios.geojson` | municipio | 5.571 features validas | fonte cartografica canonica para o mapa |

## Campos

- `cod_mun_ibge`: codigo IBGE de sete digitos; vinculo por seus seis primeiros digitos somente quando o leiaute SIM exigir.
- `nome`, `uf`, `regiao`: atributos da dimensao municipal.
- `lat`, `lon`: centroides opcionais; nao sao requisito de visualizacao ou de calculo.
- `codarea` no GeoJSON: chave de sete digitos usada no vinculo com a dimensao.
- `populacao`: denominador exato do municipio e ano; ausencia retorna `null` e status `indisponivel`.

A URL de metadados de malha usa o codigo solicitado. Nenhum calculo cientifico depende de centroides. O job IBGE prefere o Silver SIM v2 final e nao mistura SIA para inferir municipios.
