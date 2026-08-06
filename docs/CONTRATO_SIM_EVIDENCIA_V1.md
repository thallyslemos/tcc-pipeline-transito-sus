# Contrato de evidencia SIM v1

Este contrato define a base usada pela analise espaco-temporal de mortalidade por acidentes de transporte terrestre. O produto permanece agnostico a UF; Bahia e apenas o recorte cientifico inicial.

## Camadas e artefatos

- **Bronze:** partes originais do SIM preservadas em `data/bronze/sim_parts/`; o manifesto canonico registra fonte remota, hash, numero de linhas e copias redundantes.
- **Silver v2:** `data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet`; uma linha por registro recebido, com campos brutos e flags QA. Nenhuma linha e apagada nessa camada.
- **Gold SIM v1:** `data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` e `data/gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet`; cada mart e uma projecao explicita de um papel geografico.
- **QA:** `docs/metadata/sim_v2_nacional_2010_2024_contract_v2.audit.json`.

## Filtro cientifico

O numerador dos marts e `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. Isso representa obitos nao fetais com causa basica V01-V89 e sem flag principal de revisao. A Silver continua contendo o universo completo para auditoria.

Sexo ignorado permanece `Ignorado`; nunca e convertido para feminino. Idade mantem o codigo bruto, `idade`, `idade_anos` e `faixa_etaria`.

## Grao Gold

Cada linha Gold representa `tipo_local + municipio + competencia mensal + tipo_veiculo + faixa_etaria + sexo`. `total_obitos` e a contagem de `record_id`; `registros_unicos` e uma checagem de unicidade.

`cod_mun_ibge` e a chave normalizada da dimensao municipal quando ha correspondencia; `cod_mun_ibge_6` conserva a chave de compatibilidade do SIM. Codigos agregados ou historicos permanecem no mart com `geografia_status` e nao devem entrar em mapas ou taxas municipais.

## Denominadores e geometria

- Populacao e frota sao juncoes exatas por municipio e ano.
- Sem denominador valido, o numerador permanece e `taxa_obitos_100mil`/`taxa_obitos_10mil_veiculos` fica `null`, com status `indisponivel`. Nao ha fallback silencioso para o ano anterior e ausencia nunca vira zero.
- Latitude e longitude sao opcionais. A cartografia canonica e o GeoJSON oficial de malhas municipais; o mapa nao depende de centroides.

## Reexecucao e promocao

Destinos de Silver e Gold sao versionados e nao sobrescritos. Uma nova execucao deve criar outro snapshot, validar `record_id` unico, cobertura temporal, filtro, geografia e hashes, e somente entao ser promovida para o catalogo ativo.

## Serving: GET /api/sim/summary

Resposta inclui `total_obitos`, `obitos_por_ano`, `obitos_por_mes` (`competencia` YYYY-MM), `obitos_por_tipo_veiculo`, `obitos_por_faixa_etaria` e `obitos_por_sexo` (com categoria `Ignorado` quando aplicavel). A soma de cada breakdown deve igualar `total_obitos` no recorte filtrado.
