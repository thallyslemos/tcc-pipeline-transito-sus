# Diário metodológico do TCC II

Este diário registra decisões, consultas e critérios de reprodução. Ele não substitui a seção de metodologia do artigo. Seu objetivo é impedir que números sejam separados do universo que os produziu.

## Sessão de 4 e 5 de agosto de 2026

### Objetivo

O objetivo da sessão foi mapear o acervo do TCC, reconstruir as intenções registradas em conversas anteriores, confirmar as normas aplicáveis e executar uma primeira EDA reproduzível sobre a base nacional auditada do SIM.

### Isolamento do trabalho

O trabalho foi realizado na branch `docs/tcc2-writing`, no worktree `/home/thallys/projetos/tcc-pipeline-transito-sus-tcc2`. A branch da aplicação e suas alterações não foram modificadas. Nenhum arquivo foi publicado ou enviado para serviço externo, com exceção das consultas públicas às fontes oficiais e acadêmicas necessárias à pesquisa.

### Ambiente analítico

| Item | Valor |
|---|---|
| Sistema de execução | WSL Ubuntu |
| Motor analítico | DuckDB 1.4.4 |
| Linguagem do executor | Python do ambiente virtual do repositório principal |
| Script SQL da sessão | `analysis/tcc2/eda_sim_bahia_v1.sql` (artefato histórico do commit `0c8c0c0`) |
| Executor | `analysis/tcc2/run_eda_sim_bahia.py` |
| Consultas nomeadas | 27 na execução ampliada |
| Manifesto | `analysis/tcc2/results/eda_com_populacao/manifesto_execucao.json` (artefato histórico do commit `0c8c0c0`) |

### Artefatos de entrada

| Artefato | SHA-256 |
|---|---|
| Silver nacional `sim_v2_nacional_2010_2024_contract_v2.parquet` | `5869f067227d2c8ea759bbc953aa942c6c7f60fc3f8c448e663c20aa3741c74c` |
| Gold ocorrência `sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` | `e667c35224120488e5c3036fb0cb46a33b15adc26dbb00953cc0b7958215ee9c` |
| Gold residência `sim_v1_obitos_municipio_mes_residencia_v2.parquet` | `3bf1a71f0aa4a7c3d8d7fe25109122123c4d2d542e1bdca82b46fb7dda256bc9` |
| Dimensão municipal `ibge_municipios.parquet` | `2bc909833ebfcdfa2a85403bb207854ecd47cebeb72d3d18b37338ab457c2aa7` |
| Malha municipal `ibge_malhas_municipios.geojson` | `7d446f3784513549c379a9fb8f2f326714508f774c03d812817402af5ffad15a` |
| População municipal de staging | `0244fdc4cda050023234cdeed5db489723c38d4ea9f1c6c00e76db1bb61aa702` |

### Universo e filtro

A Silver contém 20.410.620 registros e 20.410.620 `record_id` distintos. O filtro executado foi `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. Ele retornou 565.383 óbitos no Brasil entre 1º de janeiro de 2010 e 31 de dezembro de 2024.

O campo `qa_flag_principal` não deve ser interpretado isoladamente como exclusão. Foram observados 3.424 registros com `qa_status = 'ok'` e `qa_flag_principal = 'idade_invalida'`. A política atual preserva esses óbitos no numerador e conduz a idade inválida para categoria ignorada. A redação deve explicar essa escolha e apresentar a incompletude da idade.

### Bronze e idempotência

A leitura física de `data/bronze/sim_parts/*.parquet` encontrou 557 arquivos e 29.789.768 linhas. Os nomes representam 405 combinações distintas de UF e ano no período de 2010 a 2024. A Silver canônica contém 20.410.620 linhas. A diferença confirma que o diretório físico possui cópias redundantes resultantes de reexecuções antigas. O numerador científico não deve ser calculado pela concatenação direta de todos os arquivos Bronze.

### Reconciliação Silver e Gold

As Gold de ocorrência e residência foram somadas por ano e UF e comparadas com a Silver filtrada. A consulta não encontrou diferenças, inclusive depois de tratar geografia nula como categoria explícita. Isso autoriza o uso das Gold para consumo agregado no mesmo snapshot e filtro, sem dispensar a Silver nas análises de fluxo e qualidade.

### População IBGE

A dimensão `data/ibge_populacao.parquet` tinha 49.206 chaves e cobertura parcial. Na Bahia, ela variava entre 325 e 373 municípios por ano, além de não conter 2010, 2022 e 2023. A revisão do job mostrou que a dimensão foi construída por chamadas individuais para combinações observadas no SIM. Falhas HTTP foram descartadas e a própria inferência considerava somente municípios de ocorrência com registros, o que torna a dimensão inadequada para uma análise de todos os municípios.

Foi criado o extrator `analysis/tcc2/fetch_ibge_population_tcc2.py`. Ele realizou chamadas anuais em lote ao SIDRA e gravou respostas brutas, hashes e um Parquet de staging. A política adotada nesta versão foi população do Censo 2010, estimativas anuais da Tabela 6579 para 2011 a 2021, população do Censo 2022 e estimativa de 2024. O ano de 2023 ficou sem denominador anual exato.

| Período | Tabela SIDRA | Variável | Natureza |
|---|---|---|---|
| 2010 | 202 | 93 | População residente do Censo 2010 |
| 2011 a 2021 | 6579 | 9324 | População residente estimada em 1º de julho |
| 2022 | 4709 | 93 | População residente do Censo 2022 |
| 2024 | 6579 | 9324 | População residente estimada em 1º de julho |

O staging contém 77.970 chaves município-ano, sem duplicidades e sem valores não positivos. A Bahia possui os 417 municípios em todos os 14 anos disponíveis. O arquivo `outputs/tcc2/ibge_populacao/manifesto_ibge_populacao.json` registra URLs, hashes e contagens. O arquivo canônico do produto não foi sobrescrito.

A comparação histórica exige cautela porque as estimativas incorporam mudanças metodológicas, revisões censitárias e alterações territoriais. O ano de 2023 não será preenchido com 2022 ou interpolado sem uma análise de sensibilidade identificada. A taxa por 100 mil habitantes será principal por residência. Uma taxa por ocorrência, quando mostrada, será chamada de taxa territorial bruta por ocorrência.

### SENATRAN — estado em 5 de agosto, superado

Não existe arquivo real de frota no repositório. A Gold contém `frota_status = 'indisponivel'` e nenhuma combinação com `frota_total`. Nenhuma taxa por 10 mil veículos será usada no artigo ou apresentada como disponível no produto até a conclusão de um pipeline oficial, mensal, versionado e auditado.

### Consultas realizadas

O protocolo executou 30 consultas. Foram examinadas cobertura Bronze; universo e QA Silver; cobertura anual nacional; totais anuais baianos por ocorrência e residência; sexo; faixa etária; categoria derivada da CID; grupos CID; sazonalidade mensal; qualidade geográfica; fluxos de origem e destino; Vitória da Conquista; ranking anual das UFs; inventário municipal; cobertura populacional; reconciliação Gold; disponibilidade de denominadores; séries municipais por ocorrência e residência; tendências exploratórias; persistência no quartil superior; ranking anual municipal; linhagem da descontinuidade observada em Barreiras; taxas estaduais; posição anual da Bahia por contagem; e auditoria agregada de Gavião em 2024.

Os resultados tabulares históricos estão em `analysis/tcc2/results/eda_com_populacao` no commit `0c8c0c0`. As tabelas de tendência e persistência são exploratórias. Elas usam taxas brutas, não aplicam suavização, não possuem intervalo de confiança e ignoram 2023 por ausência de denominador. Não podem ser transportadas diretamente para a versão final do artigo. A taxa estadual por residência foi de 20,28 por 100 mil em 2024, maior valor entre os anos com denominador desta extração. Essa comparação ainda requer cautela diante das mudanças entre estimativas intercensitárias e censos. A rodada vigente está documentada na seção de 18 de agosto e em `RESULTADOS_EDA_BAHIA_FROTA_FLUXOS_TCC2.md`.

### Auditoria de Gavião em 2024

Os 20 óbitos do recorte científico atribuídos ao município de ocorrência Gavião em 2024 foram registrados em 7 de janeiro. A agregação por causa, residência e linhagem mostrou 16 residentes de Jacobina, três de Juazeiro e um de Jaguarari. Os códigos incluem ocupantes de ônibus e veículo pesado. Todos os registros vieram do mesmo arquivo Bronze e possuem o mesmo hash de origem. A nota do Departamento de Polícia Técnica da Bahia publicada em 9 de janeiro relata colisão entre caminhão e micro-ônibus e 23 mortes. A coincidência de data, território, residência predominante e meios de transporte confirma que o extremo municipal representa um evento catastrófico específico, não duplicação do pipeline. A diferença entre 20 registros no recorte municipal do SIM e 23 mortes na nota oficial não deve ser eliminada por ajuste manual. Ela precisa ser explicada por local de ocorrência atribuído, momento do óbito, causa básica, atualização e universo de cada fonte.

### Pesquisa bibliográfica inicial

Foram priorizadas fontes primárias e periódicos indexados. Os estudos recuperados confirmam que o uso de V01 a V89, município de residência, taxas populacionais, agrupamentos plurianuais, padronização por idade, análise de Moran e suavização para pequenas áreas são práticas presentes na literatura brasileira. Entre as referências candidatas estão o estudo municipal brasileiro publicado em Public Health em 2023, DOI `10.1016/j.puhe.2023.04.013`; o estudo do Piauí publicado em Epidemiologia e Serviços de Saúde; o estudo nacional de tendências e aglomerados publicado em Ciência & Saúde Coletiva, DOI `10.1590/S1413-81232012000900002`; e o estudo de Campinas que usa V89 como indicador de qualidade do registro.

O corpus definitivo ainda será validado item a item. Nenhuma referência da revisão antiga será aceita somente porque já aparece no TCC I ou em `docs/REVISAO_LITERATURA.md`.

### Próxima decisão metodológica

A próxima etapa deve definir a análise temporal e espacial principal. A opção recomendada é usar residência como eixo de risco, agregar períodos para reduzir instabilidade, apresentar taxas brutas e suavizadas, avaliar persistência e então aplicar autocorrelação espacial com matriz de contiguidade documentada. A ocorrência e os fluxos devem formar uma análise complementar. Gavião já foi vinculado a um evento específico, mas a diferença entre as contagens do SIM e da nota oficial ainda requer reconciliação metodológica. A descontinuidade de Barreiras continua sem explicação e deve ser reproduzida em uma consulta externa antes da modelagem final.

## Sessão de 18 de agosto de 2026: revisão pós-integração da SENATRAN

### Errata do estado anterior

As afirmações da sessão de 4 e 5 de agosto sobre a inexistência de uma base real da SENATRAN descrevem corretamente o estado daquele snapshot, mas deixaram de ser atuais depois da conclusão do pipeline independente. A dimensão foi incorporada sem alterar Bronze, Silver ou Gold do SIM. O artigo passa a tratá-la como denominador complementar, não como substituto da população nem como medida de exposição individual.

### Semântica da partição do SIM

Foi confrontado o dicionário oficial da tabela DO, a nota metodológica do TABNET e a Silver nacional. Os arquivos consumidos vêm do diretório `DORES`; `uf_arquivo` foi mantida somente como partição e linhagem. `CODMUNRES` e `CODMUNOCOR` permanecem como papéis distintos da mesma dimensão municipal. A consulta nacional encontrou 29.379 divergências entre a UF de arquivo e a UF de ocorrência, mas nenhuma divergência entre a UF de arquivo e a UF de residência no snapshot adotado. Para ocorrência na Bahia, a consulta obrigatoriamente reúne todas as partições e filtra `uf_ocorrencia = 'BA'`.

### Execução adicional

O protocolo `analysis/tcc2/eda_bahia_frota_fluxos_v2.sql` foi executado no WSL com DuckDB 1.4.4 e o filtro científico vigente. O manifesto registrou dez consultas, hashes dos arquivos e amostras. A Bahia possui 417 municípios com frota em cada ano de 2010 a 2024. Entre 2010 e 2024, a frota de duas rodas passou de 790.224 para 2.031.641, enquanto os óbitos de motociclistas residentes passaram de 517 para 953. A taxa exploratória caiu de 6,54 para 4,69 por 10 mil duas rodas. A correlação municipal-ano em nível foi 0,748 e a correlação das primeiras diferenças consecutivas foi 0,040; ambas são descritivas.

O cruzamento de papéis encontrou 37.906 óbitos ocorridos na Bahia e 37.242 de residentes baianos. Os municípios com maior saldo de ocorrência sobre residência foram Salvador, Vitória da Conquista, Santo Antônio de Jesus, Feira de Santana e Barreiras. Em Vitória da Conquista, 1.054 de 2.029 ocorrências tinham residência externa. O detalhamento completo e os critérios de estabilidade estão em `docs/tcc2/RESULTADOS_EDA_BAHIA_FROTA_FLUXOS_TCC2.md`.

### Validação do serving

No recorte de ocorrência, Bahia, 2024 e categoria `Motociclista`, a API retornou 933 óbitos e 417 polígonos. A consulta independente na Silver retornou os mesmos 933 registros; a soma da camada geográfica também foi 933. O script de validação marcou as comparações como verdadeiras. A suíte Python da aplicação passou com 116 testes e nove testes ignorados quando `GOLD_DIR` foi apontado para a Gold auditada. Essa evidência demonstra paridade entre serving e base, não validade causal dos indicadores.

### Decisão editorial

O manuscrito deve preservar SIM e IBGE como núcleo, inserir SENATRAN somente na análise exploratória e atualizar o resumo, a metodologia, os resultados e a discussão. Gavião permanece como evento confirmado no SIM e contextualizado por fonte oficial externa; Barreiras permanece como quebra não explicada. A análise espacial confirmatória, a tendência formal, a sensibilidade a pequenas populações, o denominador de 2023 e a revisão bibliográfica final continuam pendentes.
