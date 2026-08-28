# Proposta de analise de fluxos residencia-ocorrencia no SIM

Status: proposta para a proxima iteracao. Nao e uma comparacao com ONSV nem deve alterar o mapa de totais.

## 1. Pergunta analitica

O modulo deve responder duas perguntas diferentes:

1. **Origens das vitimas em um local de ocorrencia**: dado um municipio onde o obito ocorreu, de quais municipios as vitimas residiam?
2. **Destinos dos residentes de um municipio**: dado um municipio de residencia, onde ocorreram os obitos de seus residentes?

Essas perguntas nao sao equivalentes. O produto deve apresentar a direcao explicitamente para evitar que residencia seja interpretada como local do evento.

## 2. Evidencia de viabilidade na Silver

A Silver nacional de contrato possui, no mesmo registro, as duas chaves municipais:

- `cod_mun_residencia_6` e `cod_mun_residencia_ibge`;
- `cod_mun_ocorrencia_6` e `cod_mun_ocorrencia_ibge`;
- nomes, UFs e status de qualidade de cada papel.

O filtro cientifico inicial permanece `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. O status geografico validado no contrato e `encontrado`; valores `nao_encontrado` devem ser mantidos em uma categoria separada e nunca descartados silenciosamente.

Uma checagem agregada da base local encontrou, em 2024, 3.105 obitos ocorridos na Bahia e 3.012 obitos de residentes da Bahia. Em Vitoria da Conquista, foram 156 obitos ocorridos no municipio; 80 tinham residencia em outro municipio (51,3%). Esse resultado e uma evidencia de que o modulo pode gerar uma EDA relevante, mas nao e uma conclusao causal.

## 3. Modelo de dados

Manter uma dimensao fisica unica de municipios, com duas referencias de papel na fato:

- `cod_mun_ocorrencia_ibge`: municipio do local do obito/acidente;
- `cod_mun_residencia_ibge`: municipio de residencia da vitima.

Nao criar dimensoes duplicadas para residencia e ocorrencia. Os nomes de papel podem ser expostos em views ou aliases (`municipio_ocorrencia` e `municipio_residencia`), mas as chaves devem permanecer auditaveis.

Para o primeiro endpoint de fluxos, usar a Silver contratual ou uma Gold de arestas com o grao:

`ano, dimensao_temporal, cod_mun_ocorrencia_ibge, cod_mun_residencia_ibge, tipo_veiculo, faixa_etaria, sexo -> obitos`.

Cada aresta deve preservar a qualidade geografica dos dois lados e a origem do numerador. Nao juntar duas Gold role-playing ja agregadas, pois isso perderia a correspondencia entre os papeis.

## 4. Contrato analitico proposto

Endpoint futuro: `GET /api/sim/fluxos`.

Parametros minimos:

- `direcao`: `origens` ou `destinos`;
- `cod_municipio`: alvo;
- `ano` ou intervalo de anos;
- `tipo_veiculo`, quando aplicavel;
- `uf`/`regiao` para limitar a busca;
- `top_n` e `min_obitos` para controlar legibilidade;
- `incluir_desconhecidos`, falso por padrao.

Resposta minima:

- municipio-alvo e papel usado;
- total de obitos do alvo;
- total com os dois municipios encontrados;
- total e proporcao de fluxos fora do proprio municipio;
- lista de arestas com municipio de origem, destino, UF, obitos, participacao e status geografico;
- notas metodologicas e filtros aplicados.

Os nomes devem ser obtidos da dimensao IBGE, nunca de uma concatenacao livre da Silver.

## 5. Metricas da EDA

Para cada alvo, mostrar:

- total de obitos;
- obitos no proprio municipio;
- obitos fora do proprio municipio;
- proporcao de entrada ou saida;
- ranking dos 10 principais fluxos;
- numero de municipios conectados;
- concentracao dos fluxos (HHI ou participacao acumulada do top 5/top 10);
- serie anual e, quando houver volume, serie mensal;
- parcela com residencia ou ocorrencia nao encontrada.

Taxas por populacao ou frota nao devem ser aplicadas automaticamente a arestas. Uma taxa de fluxo exige um denominador claramente definido para o municipio de origem/destino e deve ser adicionada somente depois de validar essa semantica.

## 6. Interface

Organizar como submodulo `Mapas > Fluxos`, separado do mapa coropletico:

- aba **Origens das vitimas**: alvo fixado como local de ocorrencia;
- aba **Destinos dos residentes**: alvo fixado como local de residencia;
- seletor de municipio-alvo, ano, dimensao temporal e tipo de veiculo;
- painel de KPIs e tabela paginada com busca;
- mapa com poligonos do recorte e arestas selecionadas;
- exportacao de CSV/Parquet da tabela e PNG/SVG do grafico, sempre com metadados e filtros.

O alvo deve ser escolhido por codigo IBGE e nome pesquisavel. O estado inicial deve exibir a tabela antes das linhas para que a leitura nao dependa do mapa.

## 7. Linhas arqueadas no mapa

Usar linhas curvas somente para `top_n` e `min_obitos` configurados. Arestas de baixo volume devem ficar na tabela, nao no mapa.

Regras visuais:

- seta indica a direcao;
- espessura representa obitos;
- cor separa entrada e saida ou destaca o alvo;
- tooltip informa origem, destino, obitos, participacao e qualidade geografica;
- poligonos sem metricas continuam visiveis em estado neutro;
- geometrias de linha nao devem sugerir rota de deslocamento ou causalidade.

Para ancorar as linhas, usar um ponto representativo derivado do poligono IBGE. Coordenadas pontuais somente podem ser usadas se a fonte e o ano estiverem documentados; na ausencia de coordenada oficial, usar ponto-on-surface/centroide calculado apenas para visualizacao e registrar essa limitacao nos metadados.

## 8. EDA inicial recomendada

1. Reproduzir o exemplo de Vitoria da Conquista em 2010-2024 e por ano.
2. Comparar entradas (ocorrencia local por residencia) e saidas (residente que morreu fora).
3. Mostrar os dez principais municipios conectados, a participacao acumulada e a parcela desconhecida.
4. Repetir a leitura para todos os municipios da Bahia e destacar apenas casos com volume minimo predefinido.
5. Comparar tipos de veiculo sem misturar denominadores.
6. Verificar estabilidade temporal antes de interpretar padroes.

Nenhuma ordenacao deve ser feita apenas por taxa quando o denominador for ausente. Os filtros cientificos e os estados de qualidade precisam aparecer na exportacao.

## 9. Privacidade e limites

O modulo trabalha apenas com agregacao municipal. Nao expor `record_id`, linha individual, nome de pessoa ou qualquer identificador direto.

Se uma tabela de arestas for publicada ou exportada, considerar um limiar minimo de celulas e documentar a regra. O objetivo e evidencia cientifica agregada, nao rastreamento de individuos.

## 10. Criterios de aceite

- direcao residencia/ocorrencia explicita no contrato e na interface;
- filtro de ano e veiculo aplicado ao numerador da aresta;
- estados `encontrado` e `nao_encontrado` separados;
- teste de soma das arestas contra o total filtrado;
- teste de simetria conceitual: origem de ocorrencia e destino de residencia usam a mesma fato;
- tabela paginada, busca e exportacao com fonte, data de atualizacao, filtros e denominadores;
- linhas curvas limitadas por `top_n` e `min_obitos`;
- nenhum fallback silencioso para populacao ou frota.
