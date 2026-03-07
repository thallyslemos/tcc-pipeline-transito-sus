THALLYS VIANA LEMOS

 **Impacto Econômico e Macrotendências de Acidentes de Trânsito no SUS: Uma Abordagem de Engenharia de Dados com DuckDB e Inteligência Artificial.**

Pré-projeto de pesquisa desenvolvido na linha de pesquisa de **Desenvolvimento de Sistemas**, sob orientação do(a) **Prof(ª). Nome Completo do(a) Orientador(a)** e coorientação **(caso haja) do(a) Prof(ª). Nome Completo do(a) Coorientador(a)**, como requisito de inscrição no componente curricular de **Trabalho de Conclusão de Curso I**, do Curso de Bacharelado em Sistemas de Informação, do Instituto Federal de Educação, Ciência e Tecnologia da Bahia, Campus Vitória da Conquista

Vitória da Conquista, 2026

**1\. Introdução**

A segurança viária representa, na atualidade, um dos mais graves problemas de saúde pública global. Segundo o *Global Status Report on Road Safety* da Organização Mundial da Saúde (OMS, 2023), aproximadamente 1,19 milhão de pessoas morrem anualmente em decorrência de acidentes de trânsito no mundo, sendo esta a principal causa de morte entre crianças e jovens adultos de 5 a 29 anos. O relatório aponta ainda que o risco de morte é três vezes superior em países de baixa renda quando comparados aos de alta renda (OMS, 2023).

No contexto brasileiro, a morbimortalidade no trânsito sobrecarrega substancialmente os sistemas de saúde, gerando custos assistenciais contínuos e reduzindo a capacidade de atendimento de outras patologias. De acordo com o Instituto de Pesquisa Econômica Aplicada, o Brasil registra aproximadamente 47 mil mortos e 300 mil feridos graves por ano em acidentes de trânsito, representando um custo estimado de R$ 40 bilhões anuais para a economia nacional, considerando custos médicos, perda de produtividade e danos materiais (IPEA, 2015). Mais recentemente, o IPEA apontou que somente o Sistema Único de Saúde (SUS) despendeu R$ 449 milhões em 2024 com internações de vítimas de trânsito (IPEA, 2025), montante que equivaleria a 1.320 ambulâncias do SAMU.

Waiselfisz (2013), no *Mapa da Violência: Acidentes de Trânsito e Motocicletas*, já evidenciava a tendência de crescimento de óbitos envolvendo motociclistas e a migração do problema para municípios menores e cidades do interior. Morais Neto et al. (2012) demonstraram que a taxa de mortalidade por acidentes de transporte terrestre no Brasil subiu de 18 para 22,5 óbitos por 100 mil habitantes entre 2000 e 2010, com aumento significativo na região Nordeste e entre motociclistas. Conforme Silva et al. (2015), o uso dos Sistemas de Informação em Saúde do DATASUS — notadamente o Sistema de Informações sobre Mortalidade (SIM) e o Sistema de Informações Ambulatoriais (SIA) — constitui ferramenta essencial para a vigilância epidemiológica de acidentes de trânsito no Brasil, embora persista a necessidade de maior integração analítica entre essas bases.

O SUS absorve a maior parte do ônus logístico e financeiro decorrente de lesões causadas pelo trânsito. Compreender o perfil dessas ocorrências e os custos associados é uma diretriz fomentada por instrumentos como o Plano Nacional de Redução de Mortes e Lesões no Trânsito — PNATRANS, criado pela Lei nº 13.614/2018, cuja versão revisada em 2023 estabelece 70 ações com potencial de salvar cerca de 86 mil vidas entre 2021 e 2030, alinhando-se à Década de Ação pela Segurança no Trânsito da ONU (BRASIL, 2018; CONTRAN, 2023). O PNATRANS exige de municípios e estados a formulação de políticas baseadas em evidências, demandando infraestrutura analítica que transforme dados brutos em indicadores acionáveis.

No entanto, a formulação destas políticas esbarra frequentemente em obstáculos tecnológicos e na qualidade da informação. Os dados referentes à saúde pública, embora abertos e centralizados pelo DATASUS (BRASIL, 2019; BRASIL, 2025), carecem de granularidade geográfica precisa a nível de logradouro. O preenchimento do local exato do acidente frequentemente se restringe ao nível municipal, o que inviabiliza o cruzamento determinístico pontual com infraestruturas de trânsito locais. Diante dessa limitação inerente aos dados da saúde no Brasil, como discutido por Bastos (2010), abordagens analíticas ecológicas — que avaliam recortes temporais e macrotendências municipais — mostram-se a alternativa metodológica viável e rigorosa para correlacionar políticas de mobilidade com redução de agravos em saúde, utilizando o recorte do Capítulo XX da Classificação Internacional de Doenças (CID-10), códigos V01 a V89 — Acidentes de Transporte Terrestre (OMS, 2016).

Para além das limitações analíticas, existe o desafio do processamento. O acesso aos dados abertos do SUS, disponibilizados muitas vezes em arquivos com compressão proprietária (formato DBC), exige o emprego de ferramentas computacionais modernas. Grus (2019), em *Data Science do Zero*, demonstra que a combinação de fundamentos estatísticos sólidos com ferramentas programáticas em Python permite abordar problemas analíticos complexos de forma iterativa, mesmo sem infraestrutura de grande porte. Este princípio orienta a construção do presente trabalho: utilizar Python como linguagem unificadora para extração, transformação, análise e visualização dos dados do SUS. Complementarmente, Fonseca (2025), em *Engenharia de Software para Cientistas de Dados*, argumenta que projetos de ciência de dados se beneficiam significativamente de práticas de engenharia de software — como versionamento, testes automatizados, pipelines reprodutíveis e modularização — princípios que foram adotados integralmente neste MVP, que utiliza `pytest` para validação do pipeline, `ruff` para qualidade de código, e a arquitetura Medallion para rastreabilidade das transformações.

O avanço da Engenharia de Dados possibilita a construção de pipelines eficientes em hardware local (*commodity hardware*) sem o custo de ecossistemas distribuídos em nuvem. Neste contexto, o sistema de gerenciamento de banco de dados analítico DuckDB desponta como ferramenta revolucionária. Raasveldt e Mühleisen (2019), em artigo publicado no ACM SIGMOD, propuseram o DuckDB como um banco de dados analítico embarcável (*in-process*), analogamente ao que o SQLite representa para cargas transacionais, porém otimizado para consultas OLAP sobre formatos colunares como o Apache Parquet. A organização dos dados segue a arquitetura Medallion (Bronze → Silver → Gold), padrão de qualidade progressiva amplamente adotado em *data lakehouses* (DATABRICKS, 2024), permitindo rastreabilidade e reprodutibilidade de cada transformação. A biblioteca PySUS (COELHO et al., 2021) viabiliza a extração automatizada dos microdados diretamente dos repositórios FTP do DATASUS, convertendo arquivos DBC para Parquet.

Em paralelo, o surgimento de tecnologias de Inteligência Artificial Generativa introduziu novas formas de interação humano-computador. Conforme Kleinberg et al. (2015) e Mullainathan e Spiess (2017), o uso de aprendizado de máquina em contextos de políticas públicas permite tanto a predição quanto a compreensão de padrões complexos. O recente *Model Context Protocol* (MCP), proposto pela Anthropic (2024), padroniza a integração entre Modelos de Linguagem de Grande Escala (LLMs) e fontes de dados externas, permitindo que os modelos consultem diretamente bancos de dados locais por meio de ferramentas (*tools*) definidas no servidor. A união dessas tecnologias — PySUS para extração, DuckDB para processamento OLAP e MCP para interface semântica — cria um ambiente propício para democratizar o acesso à informação de utilidade pública, reduzindo barreiras técnicas que impedem gestores e pesquisadores de utilizarem dados abertos em sua plenitude.

A camada de visualização do MVP adota princípios de *data storytelling*, conforme sistematizados por Knaflic (2015) em *Storytelling com Dados*. A autora propõe que visualizações eficazes devem: eliminar ruído visual (*clutter*), direcionar a atenção do leitor com atributos pré-atentivos (cor, tamanho, posição), e contextualizar os números em uma narrativa que responda a perguntas do público-alvo. Estes princípios orientaram o design dos dashboards do projeto — cada KPI é acompanhado de série temporal para contexto, gráficos de barras horizontais para ranking de municípios (facilitando a leitura de nomes longos), e um mapa georreferenciado com *circle markers* proporcionais que comunicam magnitude instantaneamente. O processo de desenvolvimento segue princípios de *Design Thinking* (BROWN, 2010), notadamente na fase de ideação e prototipagem iterativa: cada funcionalidade é concebida a partir de uma pergunta que um gestor público faria ("Qual município teve mais óbitos por motos em 2023?"), prototipada no notebook Jupyter para validação exploratória, e só então implementada no dashboard como visualização interativa.

O presente projeto justifica-se pela sua forte relevância social e inovação tecnológica. Ao propor a criação de um pipeline de dados aliado a uma interface baseada em inteligência artificial para interrogar os custos e desfechos de acidentes de trânsito em cidades como São Paulo, Belo Horizonte e Vitória da Conquista — as duas primeiras pelo volume de dados e por serem referências em dados abertos, e a última para compreender como o município se posiciona frente a grandes capitais —, o trabalho transcende a pesquisa acadêmica clássica, ofertando um Mínimo Produto Viável (MVP). Este produto tem potencial de apoiar gestores municipais na compreensão do retorno financeiro sobre os investimentos em fiscalização e planejamento urbano, unindo o rigor estatístico ao que há de mais avançado em desenvolvimento de software e *data analytics*. A camada de visualização, implementada com o framework Next.js (VERCEL, 2025) e a API REST em FastAPI (RAMÍREZ, 2021), possibilita a apresentação dos indicadores em dashboards interativos, mapas georreferenciados e interfaces conversacionais, conforme recomendado pelo Observatório Nacional de Segurança Viária (ONSV, 2023) como boas práticas de comunicação de dados sobre segurança viária.

**2\. Objetivos**

**2.1. Objetivo Geral**

* Desenvolver um Mínimo Produto Viável (MVP) compreendendo um pipeline de processamento de dados e um servidor de contexto (MCP), visando facilitar a extração, análise temporal e quantificação do impacto econômico municipal dos acidentes de trânsito nas bases do DATASUS.

**2.2. Objetivos Específicos**

* Implementar processos automatizados de extração e conversão de microdados públicos do Sistema de Informações sobre Mortalidade (SIM) e do Sistema de Informações Ambulatoriais (SIA) para o formato Parquet, utilizando a biblioteca PySUS e organizando os dados na arquitetura Medallion (Bronze → Silver → Gold).
* Estruturar um banco de dados analítico local, utilizando a tecnologia DuckDB, para realizar o processamento temporal e o cálculo dos custos totais de atendimentos relacionados a acidentes de trânsito (Classificação Internacional de Doenças — CID-10, códigos V01 a V89), enriquecidos com dados demográficos do IBGE (estimativas populacionais da Tabela 6579 SIDRA).
* Desenvolver um servidor utilizando o *Model Context Protocol* (MCP) em linguagem Python, capaz de expor consultas do banco de dados (DuckDB) para agentes de Inteligência Artificial interagirem por meio de linguagem natural, validando a viabilidade da integração entre LLMs locais e dados abertos governamentais.

**3\. Procedimentos Metodológicos**

A presente pesquisa caracterizar-se-á por ser de natureza aplicada, descritiva e exploratória, utilizando métodos mistos ancorados nos princípios de Engenharia de Dados, Informática Médica e *Design Thinking* (BROWN, 2010). O processo de desenvolvimento adota uma abordagem iterativa e incremental, alinhada às práticas de engenharia de software para ciência de dados descritas por Fonseca (2025), com ênfase em reprodutibilidade, modularização e validação contínua por meio de testes automatizados.

**Coleta e Extração de Dados:** Será realizado um levantamento retrospectivo de dados secundários de domínio público disponibilizados pelo Departamento de Informática do SUS (DATASUS). A extração terá foco no Sistema de Informações Ambulatoriais (SIA) — cuja estrutura e layout são documentados em informe técnico do Ministério da Saúde (BRASIL, 2019) — e no Sistema de Informação sobre Mortalidade (SIM), cuja estrutura é descrita pela Secretaria de Vigilância em Saúde (BRASIL, 2025). O acesso direto aos repositórios FTP governamentais será automatizado pela utilização da biblioteca de código aberto PySUS (COELHO et al., 2021), implementada na linguagem Python — escolhida por ser a linguagem predominante em ciência de dados, conforme fundamentado por Grus (2019). Esta etapa contemplará a conversão dos arquivos originais (.DBC) para formatos abertos e estruturados orientados a colunas (.Parquet), e a organização em camadas de qualidade progressiva conforme a arquitetura Medallion (DATABRICKS, 2024).

**Transformação e Modelagem:** Devido à limitação de coordenadas geográficas de logradouros nas Declarações de Óbito e guias ambulatoriais, a modelagem dos dados adotará uma abordagem estatística de série temporal agrupada por município e competência (mês/ano). O processamento analítico será executado por meio do SGBD DuckDB (RAASVELDT; MÜHLEISEN, 2019). Serão criadas *views* e materializações utilizando linguagem SQL padrão, unificando as bases pelo código do município de ocorrência do acidente e a Causa Básica (filtrada pelo Capítulo XX da CID-10, códigos V01 a V89). O cálculo de indicadores relativos — taxa de mortalidade por 100 mil habitantes e custo per capita — seguirá a metodologia do DATASUS (BRASIL, s.d.) e da Rede Interagencial de Informações para a Saúde — RIPSA (OMS/RIPSA, 2012), utilizando estimativas populacionais do IBGE (Tabela 6579 SIDRA).

**Desenvolvimento do Servidor MCP (Camada de Aplicação):** A interface de disponibilidade dos dados será construída mediante o desenvolvimento de um servidor aderente ao *Model Context Protocol* (MCP), especificação aberta proposta pela Anthropic (2024). A programação do servidor será realizada em Python, utilizando a biblioteca de abstração FastMCP. Serão programadas ferramentas (*tools*) específicas no código-fonte que traduzam as requisições em linguagem natural do usuário (por exemplo, "Qual foi o gasto público com vítimas de moto em 2023 em Vitória da Conquista?") para consultas SQL validadas contra o banco DuckDB. A API REST será implementada com o framework FastAPI (RAMÍREZ, 2021), e a interface de visualização com o framework Next.js (VERCEL, 2025), integrando dashboards projetados segundo os princípios de *data storytelling* (KNAFLIC, 2015), mapas georreferenciados e uma interface conversacional.

**Validação da Prova de Conceito:** A ferramenta será validada por meio de testes unitários e de integração no banco de dados (utilizando pytest) e avaliação da precisão e consistência das respostas geradas pelo LLM via protocolo MCP, em conformidade com as práticas de validação de pipelines de dados descritas por Fonseca (2025), confirmando a viabilidade da aplicação do ferramental de inteligência artificial sobre os dados abertos do governo brasileiro.

**4\. Cronograma**

| Etapa | Mar | Abr | Mai | Jun | Jul | Ago |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Revisão bibliográfica e elaboração da súmula | ● | ● | | | | |
| Implementação do pipeline ETL (PySUS → Parquet → DuckDB) | | ● | ● | | | |
| Desenvolvimento do MCP Server e API REST | | | ● | ● | | |
| Desenvolvimento do frontend (dashboards e mapas) | | | | ● | ● | |
| Testes, validação e ajustes | | | | | ● | ● |
| Redação do TCC e preparação da defesa | | | | | ● | ● |

**Referências**

ANTHROPIC. Model Context Protocol: Introduction and Core Concepts. 2024. Disponível em: https://modelcontextprotocol.io. Acesso em: 5 mar. 2026.

BASTOS, Jorge Tiago. **Geografia da mortalidade no trânsito no Brasil**. 2010. Tese (Doutorado em Engenharia de Transportes) – Escola de Engenharia de São Carlos, Universidade de São Paulo, São Carlos, 2010.

BRASIL. Lei nº 13.614, de 11 de janeiro de 2018. Cria o Plano Nacional de Redução de Mortes e Lesões no Trânsito (PNATRANS). **Diário Oficial da União**, Brasília, DF, 12 jan. 2018.

BRASIL. Ministério da Saúde. DATASUS. **Informe Técnico: Sistema de Informações Ambulatoriais do SUS (SIA/SUS) — Layout do Arquivo de Produção Ambulatorial**. Brasília: Ministério da Saúde, 2019.

BRASIL. Ministério da Saúde. DATASUS. **Ficha de Qualificação C.12 — Taxa de Mortalidade por Causas Externas**. Brasília: Ministério da Saúde, [s.d.]. Disponível em: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm. Acesso em: 5 mar. 2026.

BRASIL. Ministério da Saúde. Secretaria de Vigilância em Saúde. Departamento de Análise em Saúde e Vigilância de Doenças Não Transmissíveis. **Estrutura do SIM — Sistema de Informações sobre Mortalidade**. Brasília: Ministério da Saúde, 2025.

BROWN, Tim. **Design Thinking: uma metodologia poderosa para decretar o fim das velhas ideias**. Tradução Cristina Yamagami. Rio de Janeiro: Elsevier, 2010.

COELHO, Flávio Codeço et al. PySUS: A library to open DATASUS files in Python. **Repositório de Software**, GitHub, 2021. Disponível em: https://github.com/AlertaDengue/PySUS. Acesso em: 5 mar. 2026.

CONSELHO NACIONAL DE TRÂNSITO (CONTRAN). Resolução nº 1.004, de 21 de dezembro de 2023. Dispõe sobre o Plano Nacional de Redução de Mortes e Lesões no Trânsito — PNATRANS. **Diário Oficial da União**, Brasília, DF, 22 dez. 2023.

DATABRICKS. What is the Medallion Lakehouse Architecture? 2024. Disponível em: https://docs.databricks.com/en/lakehouse/medallion.html. Acesso em: 5 mar. 2026.

FONSECA, Marco. **Engenharia de Software para Cientistas de Dados**. Tradução Aldir José Coelho Corrêa da Silva. Sebastopol: O'Reilly Media, 2025. Disponível em: https://www.oreilly.com/library/view/engenharia-de-software/9798341637146/. Acesso em: 7 mar. 2026.

GRUS, Joel. **Data Science do Zero: noções fundamentais com Python**. 2. ed. Tradução Welington Nascimento. Rio de Janeiro: Alta Books, 2019. Disponível em: https://www.oreilly.com/library/view/data-science-do/9788576089988/. Acesso em: 7 mar. 2026.

INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA (IBGE). **Estimativas da População Residente — Tabela 6579**. Sistema IBGE de Recuperação Automática (SIDRA). Disponível em: https://sidra.ibge.gov.br/tabela/6579. Acesso em: 5 mar. 2026.

INSTITUTO DE PESQUISA ECONÔMICA APLICADA (IPEA). **Impactos Sociais e Econômicos dos Acidentes de Trânsito nas Rodovias Brasileiras**: relatório final. Brasília: IPEA, 2015.

INSTITUTO DE PESQUISA ECONÔMICA APLICADA (IPEA). Acidentes de trânsito custam R$ 449 milhões ao SUS em 2024. Brasília: IPEA, 2025. (Nota Técnica).

KLEINBERG, Jon; LUDWIG, Jens; MULLAINATHAN, Sendhil; SUNSTEIN, Cass R. Prediction policy problems. **American Economic Review**, v. 105, n. 5, p. 491-495, 2015.

KNAFLIC, Cole Nussbaumer. **Storytelling com Dados: um guia sobre visualização de dados para profissionais de negócios**. Tradução Cássia Zanon. Rio de Janeiro: Alta Books, 2015. Disponível em: https://archive.org/details/storytelling-com-dados-um-guia. Acesso em: 7 mar. 2026.

MORAIS NETO, Otaliba Libânio de et al. Mortalidade por acidentes de transporte terrestre no Brasil na última década: tendência e aglomerados de risco. **Ciência & Saúde Coletiva**, Rio de Janeiro, v. 17, n. 9, p. 2223-2236, 2012.

MULLAINATHAN, Sendhil; SPIESS, Jann. Machine learning: an applied econometric approach. **Journal of Economic Perspectives**, v. 31, n. 2, p. 87-106, 2017.

OBSERVATÓRIO NACIONAL DE SEGURANÇA VIÁRIA (ONSV). **Retrato da Segurança Viária no Brasil**. Campinas: ONSV, 2023.

ORGANIZAÇÃO MUNDIAL DA SAÚDE (OMS). **Classificação Estatística Internacional de Doenças e Problemas Relacionados à Saúde — CID-10**. 10. rev. Tradução: Centro Colaborador da OMS para a Classificação de Doenças em Português (CBCD). São Paulo: Editora da Universidade de São Paulo, 2016.

ORGANIZAÇÃO MUNDIAL DA SAÚDE (OMS). **Global Status Report on Road Safety 2023**. Genebra: WHO, 2023. Disponível em: https://www.who.int/publications/i/item/9789240086517. Acesso em: 5 mar. 2026.

ORGANIZAÇÃO MUNDIAL DA SAÚDE (OMS); REDE INTERAGENCIAL DE INFORMAÇÕES PARA A SAÚDE (RIPSA). **Indicadores e Dados Básicos para a Saúde no Brasil (IDB)**. Brasília: RIPSA, 2012. Disponível em: http://tabnet.datasus.gov.br/cgi/idb2012/matriz.htm. Acesso em: 5 mar. 2026.

RAASVELDT, Mark; MÜHLEISEN, Hannes. DuckDB: an Embeddable Analytical Database. In: INTERNATIONAL CONFERENCE ON MANAGEMENT OF DATA (SIGMOD), 2019, Amsterdam. **Proceedings [...]**. New York: ACM, 2019. p. 1981-1984. DOI: 10.1145/3299869.3320212.

RAMÍREZ, Sebastián. FastAPI: modern, fast (high-performance), web framework for building APIs with Python. 2021. Disponível em: https://fastapi.tiangolo.com. Acesso em: 5 mar. 2026.

SILVA, Renata Almeida et al. Uso de Sistemas de Informação em Saúde para Vigilância Epidemiológica de Acidentes de Trânsito no Brasil. **Cadernos de Saúde Pública**, Rio de Janeiro, v. 31, supl. 1, 2015.

VERCEL. Next.js: The React Framework for the Web. 2025. Disponível em: https://nextjs.org. Acesso em: 5 mar. 2026.

WAISELFISZ, Julio Jacobo. **Mapa da Violência 2013: Acidentes de Trânsito e Motocicletas**. Rio de Janeiro: CEBELA/Flacso Brasil, 2013.

WHITE, Tom. **Hadoop: The Definitive Guide**. 4. ed. Sebastopol: O'Reilly Media, 2015. (Contraponto de arquitetura Big Data distribuída).
