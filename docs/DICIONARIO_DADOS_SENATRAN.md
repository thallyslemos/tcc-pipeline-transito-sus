# Dicionario de dados SENATRAN/RENAVAM

## Resultado da auditoria local

Nao ha arquivo SENATRAN real no repositorio. Existem apenas `data-pipeline/frota_gold.py` e um teste sintetico; nao existe `data/frota/frota_normalizada_ibge.csv`, Parquet Gold, manifesto, fetcher ou hash de fonte. Portanto nenhuma taxa por frota esta disponivel no snapshot SIM v1.

Fontes oficiais a monitorar: [Estatisticas de frota SENATRAN](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/estatisticas-frota-de-veiculos-senatran), [frota 2024](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/frota-de-veiculos-2024) e [dataset RENAVAM](https://dados.transportes.gov.br/pt_BR/dataset/registro-nacional-de-veiculos-automotores-renavam). A documentacao oficial descreve recortes mensais por UF, municipio e tipo de veiculo; nao se deve assumir que a serie comeca em 2016.

## Contrato esperado

| Campo canonico | Tipo | Obrigatorio | Regra |
|---|---|---|---|
| `cod_mun_ibge` | `VARCHAR(7)` | sim | normalizar, validar contra dimensao IBGE e conservar bruto |
| `uf` | `VARCHAR(2)` | sim | conferir com o municipio, nao inferir do nome |
| `competencia` | `DATE` | sim | mes de referencia publicado; nao substituir por ano silenciosamente |
| `ano` / `mes` | inteiro | derivado | derivados de `competencia` |
| `tipo_veiculo` | texto/codigo | sim | conservar codigo e descricao do leiaute |
| `quantidade` | inteiro nao negativo | sim | unidade: veiculos registrados |
| `fonte_url` / `resource_id` | texto | sim | referencia oficial do arquivo |
| `data_atualizacao` | data/hora | sim | data do download ou publicacao |
| `hash_sha256` | texto | sim | hash do arquivo bruto/normalizado |
| `status_match_ibge` | enum | sim | `encontrado`, `nao_encontrado`, `agregado`, `revisar` |

Chave natural minima: `cod_mun_ibge + competencia + tipo_veiculo`. Duplicidade, quantidade negativa, municipio inexistente, UF divergente, unidade nao documentada e mes ausente devem bloquear a promocao.

Para taxa anual, a metodologia deve declarar o mes de referencia, por exemplo dezembro. A taxa so e calculada quando a frota do mesmo municipio, ano e referencia esta disponivel; caso contrario, retorna `null` e `frota_status=indisponivel`.
