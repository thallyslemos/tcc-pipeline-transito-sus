# Contrato de evid?ncia SIM v1

Este contrato define a base usada pela an?lise espa?o-temporal de mortalidade por acidentes de transporte terrestre. O produto permanece agn?stico ? UF; Bahia ? apenas o recorte cient?fico inicial.

## Camadas e artefatos

- **Bronze:** partes originais do SIM preservadas em `data/bronze/sim_parts/`; o manifesto can?nico registra fonte remota, hash, n?mero de linhas e c?pias redundantes.
- **Silver v2:** `data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet`. O gr?o ? uma linha por registro de ?bito recebido. Campos brutos e flags QA permanecem; nenhuma linha ? apagada nessa camada.
- **Gold SIM v1:** `data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` e `data/gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet`. Cada mart ? uma proje??o expl?cita de um papel geogr?fico.
- **QA:** `docs/metadata/sim_v2_nacional_2010_2024_contract_v2.audit.json`.

## Filtro cient?fico

O numerador dos marts ? `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. Isso representa ?bitos n?o fetais com causa b?sica V01?V89 e sem flag principal de revis?o. A Silver continua contendo o universo completo para auditoria.

Sexo ignorado permanece `Ignorado`; nunca ? convertido para feminino. Idade mant?m o c?digo bruto, `idade`, `idade_anos` e `faixa_etaria`.

## Gr?o Gold

Cada linha Gold representa `tipo_local + munic?pio + compet?ncia mensal + tipo_veiculo + faixa_etaria + sexo`. `total_obitos` ? a contagem de `record_id` e `registros_unicos` ? uma checagem de unicidade.

`cod_mun_ibge` ? a chave normalizada da dimens?o municipal quando h? correspond?ncia; `cod_mun_ibge_6` conserva a chave de compatibilidade do SIM. C?digos agregados ou hist?ricos permanecem no mart com `geografia_status` e n?o devem entrar em mapas ou taxas municipais.

## Denominadores e geometria

- Popula??o e frota s?o jun??es exatas por munic?pio e ano.
- Sem denominador v?lido, o numerador permanece e `taxa_obitos_100mil`/`taxa_obitos_10mil_veiculos` fica `null`, com status `indisponivel`. N?o h? fallback silencioso para o ano anterior e aus?ncia nunca vira zero.
- Latitude/longitude s?o opcionais. A cartografia can?nica ? o GeoJSON oficial de malhas municipais; o mapa n?o depende de centroides.

## Reexecu??o e promo??o

Destinos de Silver/Gold s?o versionados e n?o sobrescritos. Uma nova execu??o deve criar outro snapshot, validar `record_id` ?nico, cobertura temporal, filtro, geografia e hashes, e somente ent?o ser promovida para o cat?logo ativo. A repeti??o do QA/marts pode ser feita com `uv run python -m data-pipeline.run --sim-evidence --silver-v2 ... --manifest-sim ... --qa-output ...`.
