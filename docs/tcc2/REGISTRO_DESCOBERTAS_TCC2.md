# Registro de descobertas do TCC II

Este arquivo separa resultado confirmado, pista exploratória e hipótese. Uma descoberta somente entra como conclusão do artigo quando seu status for confirmado e sua interpretação estiver sustentada pelo método e pela literatura.

## Resultados confirmados pela execução atual

| ID | Descoberta | Evidência | Estado de uso |
|---|---|---|---|
| D001 | A Silver nacional contém 20.410.620 registros sem duplicidade de `record_id` | `silver_universo.csv` | Confirmado como propriedade do snapshot |
| D002 | O filtro científico retorna 565.383 óbitos no Brasil entre 2010 e 2024 | `silver_universo.csv` e `cobertura_anual_nacional.csv` | Confirmado |
| D003 | O diretório Bronze possui 557 arquivos e 29.789.768 linhas para 405 combinações UF-ano | `bronze_particoes_fisicas.csv` | Confirmado como redundância física, não como duplicidade da Silver |
| D004 | As Gold de ocorrência e residência reconciliam exatamente com a Silver filtrada | `gold_reconciliacao_anual.csv` vazio | Confirmado para o snapshot e filtro atuais |
| D005 | A Bahia registrou 37.906 óbitos por ocorrência e 37.242 por residência no período | Soma das séries e dos perfis | Confirmado, desde que a dimensão seja sempre declarada |
| D006 | Em 2024 ocorreram 3.105 óbitos na Bahia e foram registrados 3.012 óbitos de residentes da Bahia | `bahia_ocorrencia_residencia_anual.csv` | Confirmado |
| D007 | Em 2023 ocorreram 2.838 óbitos na Bahia e foram registrados 2.723 óbitos de residentes da Bahia | `bahia_ocorrencia_residencia_anual.csv` | Confirmado |
| D008 | Entre os óbitos ocorridos na Bahia, 84,38% eram do sexo masculino | `bahia_sexo.csv` | Confirmado |
| D009 | As faixas de 25 a 34, 35 a 44 e 15 a 24 anos concentraram 59,66% dos óbitos ocorridos na Bahia | `bahia_faixa_etaria.csv` | Confirmado para as faixas atuais |
| D010 | V49, V89, V29 e V09 responderam por 71,86% dos óbitos ocorridos na Bahia | `bahia_cid_grupo.csv` | Confirmado e relevante para qualidade da classificação |
| D011 | A categoria `tipo_veiculo` é derivada da CID e não descreve todos os veículos envolvidos | Código de transformação, grupos CID e distribuição | Confirmado como limitação semântica |
| D012 | Entre os óbitos ocorridos na Bahia, 54,90% tinham residência no mesmo município de ocorrência | `fluxo_ocorrencias_bahia_resumo.csv` | Confirmado |
| D013 | Entre os óbitos ocorridos na Bahia, 37,27% eram de residentes de outro município baiano e 6,42% de outra UF | `fluxo_ocorrencias_bahia_resumo.csv` | Confirmado |
| D014 | Vitória da Conquista registrou 2.029 óbitos por ocorrência no período; 1.054 vítimas residiam em outro município | `vitoria_conquista_fluxo_anual.csv` | Confirmado; proporção de 51,95% |
| D015 | Em Vitória da Conquista, em 2024, 80 dos 156 óbitos por ocorrência eram de vítimas residentes em outro município | `vitoria_conquista_fluxo_anual.csv` | Confirmado; proporção de 51,28% |
| D016 | Entre 2010 e 2024, 238 dos 1.213 residentes de Vitória da Conquista morreram em outro município | `vitoria_conquista_fluxo_anual.csv` | Confirmado; proporção de 19,62% |
| D017 | A dimensão populacional canônica estava incompleta na Bahia | `ibge_populacao_cobertura.csv` da execução inicial | Confirmado como problema de pipeline |
| D018 | O staging SIDRA alcançou os 417 municípios baianos em 14 anos, sem duplicidades ou valores não positivos | `manifesto_ibge_populacao.json` | Confirmado; falta 2023 |
| D019 | Não existe base SENATRAN real e nenhuma taxa por frota está disponível | `DICIONARIO_DADOS_SENATRAN.md` e `gold_denominadores.csv` | Confirmado |
| D020 | Em 2024, a Bahia ocupou a terceira posição nacional por contagem de óbitos ocorridos e respondeu por 8,36% dos registros com UF de ocorrência conhecida | `bahia_posicao_nacional_ocorrencia.csv` | Confirmado como contagem absoluta, não como comparação de risco |
| D021 | Os 20 óbitos atribuídos a Gavião em 2024 possuem data de 7 de janeiro e pertencem ao mesmo arquivo de origem; 16 vítimas residiam em Jacobina, três em Juazeiro e uma em Jaguarari | `gaviao_2024_auditoria_agregada.csv` | Confirmado no SIM; corresponde temporal e territorialmente ao acidente entre micro-ônibus e caminhão documentado pelo DPT da Bahia |

## Pistas exploratórias que exigem aprofundamento

| ID | Pista | Evidência inicial | Risco de interpretação | Próxima validação |
|---|---|---|---|---|
| E001 | Dezembro possui a maior participação mensal no período, com 9,57% | `bahia_sazonalidade_mensal.csv` | Meses têm números de dias diferentes e a composição anual mudou | Calcular taxas diárias, série ano-mês e modelo sazonal |
| E002 | Irecê, Santo Antônio de Jesus, Guanambi, Vitória da Conquista, Jequié, Alagoinhas e Itabela ficaram no quartil superior da taxa territorial por ocorrência em todos os 14 anos com denominador | `bahia_persistencia_quartil_superior.csv` | Taxa bruta por ocorrência, sem suavização e com 2023 ausente | Repetir por residência, agrupar períodos e aplicar suavização |
| E003 | Barreiras passa de 0 a 10 óbitos anuais por ocorrência entre 2010 e 2015 para 92 em 2016 | Série municipal e `barreiras_auditoria_linhagem.csv` | Pode refletir qualidade, cobertura, codificação ou mudança real | Reproduzir TabNet, examinar CID, datas, local e boletins regionais |
| E004 | A série por residência de Barreiras também muda de 3 em 2015 para 30 em 2016 | `bahia_municipios_serie_anual_residencia.csv` | A mudança em dois papéis reduz a hipótese de simples centralidade hospitalar | Comparar com total de causas externas e completude local |
| E005 | Gavião registra 20 óbitos por ocorrência em 2024, todos em 7 de janeiro, produzindo taxa bruta de 445,14 por 100 mil | Série municipal, `gaviao_2024_auditoria_agregada.csv` e nota do DPT da Bahia | Um evento catastrófico domina a taxa anual de um município pequeno; a nota oficial registra 23 mortes, número diferente do recorte municipal do SIM | Reconciliar local, momento do óbito e universo das contagens antes de comparar números; manter o caso como demonstração de instabilidade e contexto |
| E006 | A Bahia cresce de 2.838 óbitos por ocorrência em 2023 para 3.105 em 2024 | Série anual | Comparação de dois anos não define tendência | Estimar tendência e verificar atualização do snapshot |
| E007 | A diferença entre ocorrência e residência aumenta em 2023 e 2024 | Série por papel geográfico | Pode refletir mobilidade interestadual, centralidade ou atualização desigual | Decompor fluxos por UF e município de origem |

## Descobertas descartadas ou interditadas

| ID | Afirmação anterior | Motivo | Decisão |
|---|---|---|---|
| X001 | A Bahia teve 35.793 óbitos de 2010 a 2024 | Número anterior à auditoria e sem dimensão claramente fixada | Não reutilizar |
| X002 | A Bahia teve 3.041 óbitos em 2024 como total geral | Refere-se a outro universo do arquivo de residência e não ao filtro nacional atual | Usar somente com universo reproduzido e rotulado |
| X003 | Sexo ignorado pode ser incorporado ao feminino | Erro da transformação legada | Proibido |
| X004 | A taxa por 10 mil veículos está disponível | Não há fonte SENATRAN materializada | Proibido até nova auditoria |
| X005 | ONSV deve ser comparador visível do produto | O usuário definiu a comparação apenas como teste interno | Fora do produto e do objetivo científico |
| X006 | O notebook antigo sustenta a EDA do TCC II | Usa Silver, Gold e escopo legados | Reaproveitar apenas estrutura |
| X007 | TimesFM é contribuição central | Não responde à pergunta principal e não foi comparado a baselines adequados | Trabalho futuro ou experimento separado |

## Critério de promoção

Uma pista exploratória será promovida para resultado confirmado somente depois de reproduzir a consulta, verificar sua estabilidade, comparar com uma referência independente quando possível, avaliar a influência de nulos e pequenas contagens e registrar uma interpretação que não ultrapasse o desenho ecológico. Uma explicação causal exigirá evidência externa específica e não será inferida da série do SIM.
