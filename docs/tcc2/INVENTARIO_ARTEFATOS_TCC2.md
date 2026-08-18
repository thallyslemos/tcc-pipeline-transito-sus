# Inventário de artefatos para o TCC II

Data do inventário: 4 e 5 de agosto de 2026. Este documento organiza o material disponível para a escrita do TCC II. Ele não transforma rascunhos, notas ou resultados antigos em evidência científica. A ordem de precedência definida aqui deve ser respeitada durante toda a redação.

## 1. Fontes canônicas de intenção e escopo

| Prioridade | Artefato | Papel no TCC II | Regra de uso |
|---|---|---|---|
| P0 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\outputs\diagnostico-roadmap-tcc2.md` | Delimitação da pergunta, contribuição, unidade de análise e roteiro de transição | Prevalece sobre o escopo amplo do TCC I |
| P0 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\outputs\protocolo-auditoria-silver-sim.md` | Critérios de liberação científica da Silver | Deve orientar toda consulta e promoção de resultados |
| P0 | `/home/thallys/projetos/tcc-pipeline-transito-sus/AGENTS.md` | Escopo operacional SIM-only e regras atuais do repositório | Deve ser lido antes de qualquer alteração ou execução |
| P0 | `/home/thallys/projetos/tcc-pipeline-transito-sus/docs/CONTRATO_SIM_EVIDENCIA_V1.md` | Filtro científico, grãos, papéis geográficos e denominadores | É o contrato analítico vigente |

A pergunta de pesquisa provisória mais madura é: como a mortalidade por acidentes de transporte terrestre evoluiu e se distribuiu espacialmente entre os municípios da Bahia de 2010 a 2024, e quais padrões persistentes, concentrações territoriais e desigualdades de risco podem ser identificados após a padronização pela população? A frota da SENATRAN poderá sustentar uma análise complementar somente depois de existir uma dimensão real, versionada e auditada.

## 2. TCC I e materiais do orientador

| Prioridade | Artefato | Situação | Uso recomendado |
|---|---|---|---|
| P0 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\work\source-review\TCC_I_Thallys_Final_Aceito.docx` | Versão final aceita | Referência principal de voz, trajetória, estrutura original e compromissos assumidos |
| P0 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\work\source-review\TCC_I_Thallys_Final_Aceito.pdf` | Representação fixa em 14 páginas | Referência visual e de paginação |
| P0 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\work\source-review\Correções TCC Thallys.docx` | Parecer de 1º de julho de 2026 | Checklist editorial e metodológico obrigatório |
| P1 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\work\source-review\TCC_Apresentacao_Thallys.pptx` | Apresentação original | Recuperação da narrativa oral |
| P1 | `C:\Users\thall\Documents\Codex\2026-07-30\tcc-sinistralidade-sus\work\source-review\TCC_Apresentacao_Thallys (1).pptx` | Apresentação posterior | Comparação da seleção de mensagens |

Os números do TCC I foram produzidos antes da correção da duplicação do ETL e não podem ser reaproveitados sem nova consulta. O mesmo vale para as afirmações de originalidade, os resultados do notebook antigo, a previsão TimesFM, os custos do SIA e as referências ainda não verificadas.

As versões intermediárias organizadas estão em `C:\Users\thall\OneDrive\Documentos\IFBA\TCC1\secoes_tcc1`. Os arquivos mais úteis são `metodologia\Metodologia - TCC I.docx`, `fundamentacao_teorica\TCC_I_Secao5_Fundamentacao_Teorica.docx` e `trabalhos_relacionados\Planejamento TCC_ Dados de Trânsito e Óbitos.docx`. As orientações textuais do professor nesses mesmos diretórios devem prevalecer sobre preferências estilísticas anteriores. Elas pedem concisão, texto corrido, poucas subseções, ausência de negrito no corpo, referências conforme o modelo e fundamentação teórica reduzida.

## 3. Evidências técnicas e científicas do repositório

| Prioridade | Caminho | Conteúdo | Uso |
|---|---|---|---|
| P0 | `docs/RELATORIO_AUDITORIA_SILVER_SIM_INICIAL.md` | Duplicidades, erro de sexo, idade e geografia da Silver legada | Explicar por que a evidência foi reconstruída |
| P0 | `docs/RELATORIO_VALIDACAO_SILVER_V2_SIM_BA_2010_2024.md` | Validação da Silver v2 baiana | Contextualizar a transição para a base nacional |
| P0 | `docs/RELATORIO_RECONCILIACAO_ONSV_DATASUS_2024.md` | Reconciliação interna com a metodologia ONSV | Teste de sanidade, não funcionalidade do produto |
| P0 | `docs/PROPOSTA_FLUXOS_RESIDENCIA_OCORRENCIA.md` | Perguntas, grão e limites da análise de fluxos | Base para estudo exploratório de origem e destino |
| P0 | `docs/Estrutura_do_SIM_2025.md` | Leiaute oficial convertido para texto | Validação semântica de campos |
| P0 | `docs/DICIONARIO_DADOS_IBGE.md` | Cadastro, população, malha e limitações | Contrato das dimensões IBGE |
| P0 | `docs/DICIONARIO_DADOS_SENATRAN.md` | Auditoria e contrato esperado | Prova de que ainda não há base real de frota |
| P0 | `docs/metadata/sim_v2_nacional_2010_2024_contract_v2.audit.json` | Auditoria da Silver nacional | Evidência de qualidade do snapshot adotado |
| P1 | `docs/RADAR_PYSUS_DUCKLAKE_SIM.md` | Avaliação PySUS 2.x e DuckLake | Discussão técnica e trabalho futuro |
| P1 | `docs/REVISAO_LITERATURA.md` | Revisão construída no escopo antigo | Fonte de pistas, nunca de referências sem nova validação |

Os scripts de maior valor metodológico são `data-pipeline/silver_v2.py`, `data-pipeline/sim_evidence.py`, `data-pipeline/gold.py`, `scripts/auditar_silver_sim.py`, `scripts/reconciliar_sim_oficial.py` e `scripts/gerar_sim_evidence.py`. Os testes correspondentes demonstram a implementação, mas a metodologia do artigo deve explicar os critérios científicos em linguagem independente do código.

## 4. Dados canônicos e derivados

| Camada | Artefato | Situação | Decisão |
|---|---|---|---|
| Bronze | `/home/thallys/projetos/tcc-pipeline-transito-sus/data/bronze/sim_parts/` | 557 arquivos físicos para 405 combinações UF-ano | Preservar e usar somente com o manifesto canônico |
| Silver | `data/silver/sim_v2_nacional_2010_2024_contract_v2.parquet` | 20.410.620 registros, `record_id` único | Fonte principal das consultas individuais e dos fluxos |
| Gold ocorrência | `data/gold/sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet` | Reconciliada com a Silver para o filtro científico | Consumo agregado com papel territorial explícito |
| Gold residência | `data/gold/sim_v1_obitos_municipio_mes_residencia_v2.parquet` | Reconciliada com a Silver para o filtro científico | Consumo agregado com papel populacional explícito |
| Municípios | `data/ibge_municipios.parquet` | 5.537 códigos, Bahia completa com 417 municípios | Válida para nomes e papéis presentes, incompleta como cadastro nacional universal |
| Malha | `data/ibge_malhas_municipios.geojson` | 5.571 feições | Fonte cartográfica principal |
| População antiga | `data/ibge_populacao.parquet` | Cobertura parcial por falhas de chamadas unitárias | Não usar em resultados científicos |
| População de staging | `outputs/tcc2/ibge_populacao/ibge_populacao_municipal_tcc2.parquet` | Bahia completa em 2010, 2011 a 2022 e 2024 | Usar na EDA até promoção formal; 2023 permanece sem taxa exata |
| SENATRAN | Não existe arquivo real no snapshot | Ausente | Não calcular taxa por frota |

O cache bruto do PySUS em `/home/thallys/pysus` ocupa aproximadamente 30 GB e contém as 405 combinações esperadas de 27 UFs por 15 anos. Ele deve permanecer imutável. O diretório `data` do repositório ocupa aproximadamente 33 GB. Os backups Gold e as versões sem o sufixo `_v2` não devem alimentar o artigo.

## 5. EDA e consultas reproduzíveis

O notebook `notebooks/01_eda_transito_sus.ipynb` é legado. Ele usa Silver e Gold anteriores, inclui SIA e contém resultados produzidos antes da auditoria. Sua estrutura pode inspirar visualizações, mas seus números estão interditados.

A nova EDA está em `analysis/tcc2`. O arquivo `eda_sim_bahia_v1.sql` contém consultas nomeadas para Bronze, Silver, Gold, IBGE, perfil epidemiológico, séries, denominadores e fluxos. O arquivo `run_eda_sim_bahia.py` executa o protocolo no WSL, gera CSVs e registra hashes, versão do DuckDB, filtro e amostras em `manifesto_execucao.json`. O extrator `fetch_ibge_population_tcc2.py` obtém os denominadores oficiais em lote e não sobrescreve a dimensão canônica.

## 6. Pesquisas locais e corpus bibliográfico

| Prioridade | Artefato local | Tema | Estado de validação |
|---|---|---|---|
| P1 | `C:\Users\thall\Downloads\Estabelecimento de metas de redução de mortes no trânsito nos municípios brasileiros.pdf` | Metas municipais | Identificar autoria, veículo e método antes de citar |
| P1 | `C:\Users\thall\Downloads\ESTIMATIVA DE METAS DE REDUÇÃO DO NÚMERO DE MORTES NO TRÂNSITO NO BRASIL_COM NOME.pdf` | Metas nacionais | Validar DOI e versão |
| P1 | `C:\Users\thall\Downloads\Mortalidade por acidentes de trânsito.pdf` | Mortalidade | Identificar publicação canônica |
| P1 | `C:\Users\thall\Downloads\acidentes-transito-brasil-dados-tendencias.pdf` | Tendências nacionais | Validar origem |
| P1 | `C:\Users\thall\Downloads\who-2025.pdf` | Segurança viária global | Conferir título e edição oficial |
| P1 | `C:\Users\thall\Downloads\9789241565684-eng.pdf` | Relatório da OMS | Conferir edição e estatísticas usadas |
| P1 | `C:\Users\thall\Downloads\Pipelinereprodutível com PYTHONPYSUS para extração e análise do Departamento de Informática do Sistema Único de Saúde (DATASUS) Série temporal e perfil por sexo de ITU no SIH-RD(MG e AC), 2024.pdf` | Reprodutibilidade com PySUS | Comparação metodológica |
| P1 | `C:\Users\thall\Downloads\SCALABLE ETL PIPELINE FOR HEALTH DATA INGESTION.pdf` | Engenharia de dados em saúde | Validar veículo e condição de publicação |
| P2 | `C:\Users\thall\Downloads\artigo1_analise_espacial_temporal.pdf` | Produto intermediário | Pista de análise, não fonte citável |
| P2 | `C:\Users\thall\Downloads\artigo3_metricas_comparativas.pdf` | Produto intermediário | Pista de análise, não fonte citável |
| P2 | `C:\Users\thall\Downloads\ANALISE_TRABALHOS_RELACIONADOS.pdf` | Síntese anterior | Revalidar todas as referências |

As notas em `C:\Users\thall\Documents\obsidian-vault-notes\notes\01-tcc` e nos diretórios `conceitos`, `fontes` e `02-produto` preservam a evolução intelectual do projeto. O mapa de conteúdo está desatualizado, menciona Campina Grande e aponta para arquivos inexistentes. Essas notas ajudam a recuperar intenções, mas não sustentam números.

## 7. Modelos, normas e precedência institucional

O modelo aplicável é o da Sociedade Brasileira de Computação, SBC, e não o da SBPC. O arquivo institucional mais direto é `C:\Users\thall\Downloads\[TCC I] Orientações para elaboração - Template da SBC.docx`. As três cópias encontradas são idênticas. O pacote original está em `C:\Users\thall\Downloads\modelosparapublicaodeartigos.zip`, também com três cópias idênticas.

O Regulamento de TCC do Bacharelado em Sistemas de Informação do IFBA, Campus Vitória da Conquista, permite monografia ou artigo. Para artigo, determina o template da SBC ou o template do veículo de submissão. O barema reserva 3,5 pontos de 10 para Resultados e Discussão. A relevância representa 40% da nota final. O texto deve, portanto, demonstrar uma contribuição científica defensável, método reproduzível e utilidade real do produto.

As normas citadas ou complementares são NBR 10520:2023 para citações, NBR 6028:2021 para resumo, NBR 6024:2012 para numeração, NBR 6022:2018 para artigo e NBR 6023:2025 para referências. A adoção formal da NBR 6023:2025 deve ser confirmada com o professor ou a Biblioteca porque o regulamento ainda cita a edição de 2018. Também devem ser confirmados o limite total de páginas e a política específica de uso de inteligência artificial no TCC II.

## 8. Histórico de decisões recuperado no Codex

| Conversa | Identificador | Contribuição recuperada |
|---|---|---|
| Rotina e Foco | `019fb59b-2b46-7220-bb57-842e8757525c` | Ambição acadêmica, prioridade do semestre, escrita melhor que a do TCC I e entregas fechadas |
| Organizar TCC de sinistralidade SUS | `019fb5c3-f780-7752-9f49-4417d757930f` | Delimitação do artigo, pergunta científica e separação entre produto e pesquisa |
| Auditar camada Silver do SIM | `019fb5f8-95c5-7e70-9395-aa31cf776112` | Correções do ETL, contrato SIM, residência e ocorrência, PySUS, ONSV, mapa e escopo SIM-only |
| Bloco profundo de sábado | `019fbd32-5437-7280-bc29-1698cd9d6120` | Sessões de três horas com entrega fechada |
| Foco de segunda | `019fcf64-561f-7041-8267-71a4d743982b` | Uma tarefa de até 90 minutos com definição objetiva de pronto |

## 9. Repositórios relacionados

Foram encontrados `/home/thallys/projetos/WISELY-FD`, `/home/thallys/projetos/areasearcher`, `/home/thallys/projetos/redes-moveis/projeto-jequie-planalto` e `/home/thallys/projetos/team-hermes`. Eles demonstram experiência técnica e podem conter padrões de arquitetura ou organização, mas não possuem relação científica direta com a mortalidade no trânsito. Devem permanecer fora do contexto de redação, salvo quando um artefato específico for indicado pelo autor.

## 10. Ordem obrigatória de leitura

A sequência de trabalho é o TCC I aceito e as correções, seguida pelo diagnóstico do TCC II, pelo protocolo de auditoria, pelo contrato SIM, pelos relatórios Silver e de reconciliação, pelos leiautes oficiais, pelos dicionários IBGE e SENATRAN, pelas consultas novas e, somente depois, pelo corpus bibliográfico. Versões antigas, Obsidian, apresentações e documentos de escopo amplo entram apenas como memória do processo.
