# Dicion?rio de dados SENATRAN/RENAVAM

## Resultado da auditoria local

N?o h? arquivo SENATRAN real no reposit?rio. Existem apenas `data-pipeline/frota_gold.py` e um teste sint?tico; n?o existe `data/frota/frota_normalizada_ibge.csv`, Parquet Gold, manifesto, fetcher ou hash de fonte. Portanto nenhuma taxa por frota est? dispon?vel no snapshot SIM v1.

Fontes oficiais a monitorar: [Estat?sticas de frota SENATRAN](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/estatisticas-frota-de-veiculos-senatran), [frota 2024](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/frota-de-veiculos-2024) e [dataset RENAVAM](https://dados.transportes.gov.br/pt_BR/dataset/registro-nacional-de-veiculos-automotores-renavam). A documenta??o oficial descreve recortes mensais por UF, munic?pio e tipo de ve?culo; n?o se deve assumir que a s?rie come?a em 2016.

## Contrato esperado

| Campo can?nico | Tipo | Obrigat?rio | Regra |
|---|---|---|---|
| `cod_mun_ibge` | `VARCHAR(7)` | sim | normalizar, validar contra dimens?o IBGE e conservar bruto |
| `uf` | `VARCHAR(2)` | sim | conferida com o munic?pio, n?o inferida do nome |
| `competencia` | `DATE` | sim | m?s de refer?ncia publicado; n?o substituir por ano silenciosamente |
| `ano` / `mes` | inteiro | derivado | derivados de `competencia` |
| `tipo_veiculo` | texto/c?digo | sim | conservar c?digo e descri??o do layout |
| `quantidade` | inteiro n?o negativo | sim | unidade: ve?culos registrados |
| `fonte_url` / `resource_id` | texto | sim | refer?ncia oficial do arquivo |
| `data_atualizacao` | data/hora | sim | data do download ou publica??o |
| `hash_sha256` | texto | sim | hash do arquivo bruto/normalizado |
| `status_match_ibge` | enum | sim | `encontrado`, `nao_encontrado`, `agregado`, `revisar` |

Chave natural m?nima: `cod_mun_ibge + competencia + tipo_veiculo`. Duplicidade, quantidade negativa, munic?pio inexistente, UF divergente, unidade n?o documentada e m?s ausente devem bloquear a promo??o.

Para taxa anual, a metodologia deve declarar o m?s de refer?ncia (por exemplo, dezembro). A taxa s? ? calculada quando a frota do mesmo munic?pio, ano e refer?ncia est? dispon?vel; caso contr?rio, retorna `null` + `frota_status=indisponivel`.
