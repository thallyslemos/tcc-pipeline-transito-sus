THALLYS VIANA LEMOS

 **Impacto Econômico e Macrotendências de Acidentes de Trânsito no SUS: Uma Abordagem de Engenharia de Dados com DuckDB e Inteligência Artificial.**

Pré-projeto de pesquisa desenvolvido na linha de pesquisa de **Desenvolvimento de Sistemas**, sob orientação do(a) **Prof(ª). Nome Completo do(a) Orientador(a)** e coorientação **(caso haja) do(a) Prof(ª). Nome Completo do(a) Coorientador(a)**, como requisito de inscrição no componente curricular de **Trabalho de Conclusão de Curso I**, do Curso de Bacharelado em Sistemas de Informação, do Instituto Federal de Educação, Ciência e Tecnologia da Bahia, Campus Vitória da Conquista

Vitória da Conquista, 2026

**1\. Introdução**

Em forma de texto corrido, esta seção deverá apresentar contextualização, referencial teórico e justificativa. Considerando esta seção e as seções seguintes, devem ser redigidas de 3 (três) a 5 (cinco) páginas de elementos textuais (elementos pré-textuais e seção de referências não devem ser contabilizados).

Os trabalhos só podem ser desenvolvidos se estiverem de acordo com as áreas de conhecimento previstas no Projeto Pedagógico de Curso, a saber:

* Desenvolvimento de sistemas;  
* Gestão e governança de Tecnologia da Informação;  
* Infraestrutura de ambientes computacionais.

Essas áreas caracterizam as linhas de pesquisa do curso. Deverá ser apresentado referencial teórico mínimo para o desenvolvimento do trabalho, **citando ao menos 10 (dez) autores diferentes sobre o tema escolhido.** As citações devem ser adequadas à subárea de conhecimento do curso escolhida. Todas as citações devem estar de acordo com a norma técnica NBR 10520:2023.

A segurança viária representa, na atualidade, um dos mais graves problemas de saúde pública global. A morbimortalidade no trânsito sobrecarrega substancialmente os sistemas de saúde, gerando custos assistenciais contínuos e reduzindo a capacidade de atendimento de outras patologias. No Brasil, o Sistema Único de Saúde (SUS) absorve a maior parte do ônus logístico e financeiro decorrente de lesões causadas pelo trânsito. Compreender o perfil destas ocorrências e os custos associados é uma diretriz fomentada por instrumentos como o Plano Nacional de Redução de Mortes e Lesões no Trânsito (PNATRANS), que exige de municípios e estados políticas baseadas em evidências.

No entanto, a formulação destas políticas esbarra frequentemente em obstáculos tecnológicos e na qualidade da informação. Os dados referentes à saúde pública, embora abertos e centralizados pelo DATASUS por meio de sistemas como o Sistema de Informações sobre Mortalidade (SIM) e o Sistema de Informações Ambulatoriais (SIA) , carecem de granularidade geográfica precisa a nível de logradouro. O preenchimento do local exato do acidente frequentemente se restringe ao nível municipal, o que inviabiliza o cruzamento determinístico pontual com infraestruturas de trânsito locais, como a instalação de radares específicos em certas vias. Diante dessa limitação inerente aos dados da saúde no Brasil, abordagens analíticas ecológicas, que avaliam recortes temporais e macrotendências municipais, mostram-se a alternativa metodológica viável e rigorosa para correlacionar políticas de mobilidade com redução de agravos em saúde.

Para além das limitações analíticas, existe o desafio do processamento. O acesso aos dados abertos do SUS, disponibilizados muitas vezes em arquivos com compressão proprietária (arquivos DBC), exige o emprego de ferramentas computacionais modernas. O avanço da Engenharia de Dados possibilita a construção de pipelines eficientes em hardware local (commodity hardware) sem o custo de ecossistemas distribuídos em nuvem. Neste contexto, o sistema de gerenciamento de banco de dados analítico DuckDB desponta como uma ferramenta revolucionária devido à sua execução em memória (in-process) e leitura otimizada de formatos colunares como o Apache Parquet.

Em paralelo, o surgimento de tecnologias de Inteligência Artificial Generativa introduziu novas formas de interação humano-computador. O recente Model Context Protocol (MCP) padroniza a integração entre Modelos de Linguagem de Grande Escala (LLMs) e fontes de dados externas, permitindo que os modelos consultem diretamente bancos de dados locais. A união destas tecnologias (PySUS para extração, DuckDB para processamento OLAP e MCP para interface semântica) cria um ambiente propício para democratizar o acesso à informação de utilidade pública.

O presente projeto justifica-se pela sua forte relevância social e inovação tecnológica. Ao propor a criação de um pipeline de dados aliado a uma interface baseada em inteligência artificial para interrogar os custos e desfechos de acidentes de trânsito em cidades como São Paulo, Belo Horizonte e Vitória da Conquista (as duas primeiras pelo volume de dados e por serem referências em dados abertos e a última para entendermos como nos encontramos frente a grandes capitais, o trabalho transcende a pesquisa acadêmica clássica, ofertando um Mínimo Produto Viável (MVP). Este produto tem potencial de apoiar gestores municipais na compreensão do retorno financeiro sobre os investimentos em fiscalização e planejamento urbano, unindo o rigor estatístico ao que há de mais avançado em desenvolvimento de software e data analytics.

**2\. Objetivos**

Nesta seção, devem ser apresentados o objetivo geral e os objetivos específicos do trabalho. **Consideram-se suficientes 3 (três) objetivos específicos**. Menos que essa quantidade, considera-se que o trabalho é de escopo insuficiente; acima disso, o tamanho do escopo pode ser considerado excessivamente grande para um trabalho de graduação.

**2.1. Objetivo Geral**

* Desenvolver um Mínimo Produto Viável (MVP) compreendendo um pipeline de processamento de dados e um servidor de contexto (MCP), visando facilitar a extração, análise temporal e quantificação do impacto econômico municipal dos acidentes de trânsito nas bases do DATASUS.

**2.2. Objetivos Específicos**

* Implementar processos automatizados de extração e conversão de microdados públicos do Sistema de Informações sobre Mortalidade (SIM) e do Sistema de Informações Ambulatoriais (SIA) para o formato Parquet.  
* Estruturar um banco de dados analítico local, utilizando a tecnologia DuckDB, para realizar o processamento temporal e o cálculo dos custos totais de atendimentos relacionados a acidentes de trânsito (Classificação Internacional de Doenças \- CID-10 V01 a V89).  
* Desenvolver um servidor utilizando o *Model Context Protocol* (MCP) em linguagem Python, capaz de expor consultas do banco de dados (DuckDB) para agentes de Inteligência Artificial interagirem através de linguagem natural.

**3\. Procedimentos Metodológicos**

A presente pesquisa caracterizar-se-á por ser de natureza aplicada, descritiva e exploratória, utilizando métodos mistos ancorados nos princípios de Engenharia de Dados e Informática Médica.

Coleta e Extração de Dados: Será realizado um levantamento retrospectivo de dados secundários de domínio público disponibilizados pelo Departamento de Informática do SUS (DATASUS). A extração terá foco no Sistema de Informações Ambulatoriais (SIA) e no Sistema de Informação sobre Mortalidade (SIM). O acesso direto aos repositórios FTP governamentais será automatizado pela utilização da biblioteca de código aberto PySUS, implementada na linguagem Python. Esta etapa contemplará a conversão dos arquivos originais (.DBC) para formatos abertos e estruturados orientados a colunas (.Parquet).

Transformação e Modelagem: Devido à limitação de coordenadas geográficas de logradouros nas Declarações de Óbito e guias ambulatoriais, a modelagem dos dados adotará uma abordagem estatística de série temporal agrupada por município e competência (mês/ano). O processamento analítico será executado por meio do SGBD DuckDB. Serão criadas views e materializações utilizando linguagem SQL padrão, unificando as bases pelo código do município de ocorrência do acidente e a Causa Básica (filtrada pelo capítulo XX da CID-10).

Desenvolvimento do Servidor MCP (Camada de Aplicação): A interface de disponibilidade dos dados será construída mediante o desenvolvimento de um servidor aderente ao Model Context Protocol (MCP). A programação do servidor será realizada em Python, utilizando a biblioteca de abstração FastMCP. Serão programadas ferramentas (tools) específicas no código fonte que traduzam as requisições em linguagem natural do usuário (por exemplo, "Qual foi o gasto público com vítimas de moto em 2023 em Vitória da Conquista?") para consultas SQL validadas contra o banco DuckDB.

Validação da Prova de Conceito: A ferramenta será validada através de testes unitários no banco de dados e avaliação da precisão e consistência das respostas geradas pelo LLM via protocolo MCP, confirmando a viabilidade da aplicação do ferramental de inteligência artificial sobre os dados abertos do governo brasileiro..

**4\. Cronograma**

Nesta seção, poderá ser proposto pelo(a) discente um cronograma para a condução do trabalho no componente curricular de Trabalho de Conclusão de Curso I. Em virtude da esperada relativa falta de experiência do(a) discente na escrita científica neste estágio, **esta seção é facultativa.**

**Referências**

Nesta seção, deverá ser observada a norma técnica NBR 6023:2018. Alguns exemplos:

BASTOS, Jorge Tiago. Geografia da mortalidade no trânsito no Brasil. 2010\. Tese (Doutorado em Engenharia de Transportes) – Universidade de São Paulo, São Carlos, 2010\.

BRASIL. Ministério da Saúde. Secretaria de Vigilância em Saúde. Departamento de Análise em Saúde e Vigilância de Doenças Não Transmissíveis. Estrutura do SIM. Brasília: Ministério da Saúde, 2025\.

BRASIL. Ministério da Saúde. DATASUS. Informe Técnico: Sistema de Informações Ambulatoriais do SUS (SIA/SUS). Layout do Arquivo de Produção Ambulatorial. Brasília: Ministério da Saúde, 2019\.

COELHO, Flávio Codeço et al. PySUS: A library to open DATASUS files in Python. Repositório de Software, GitHub, 2021\. Disponível em: https://github.com/AlertaDengue/PySUS.

KLEINBERG, Jon; LUDWIG, Jens; MULLAINATHAN, Sendhil; SUNSTEIN, Cass R. Prediction policy problems. American Economic Review, v. 105, n. 5, p. 491-495, 2015\.

MODEL CONTEXT PROTOCOL (MCP). Introduction and Core Concepts. Anthropic, 2024\. Disponível em: https://modelcontextprotocol.io.

MULLAINATHAN, Sendhil; SPIESS, Jann. Machine learning: an applied econometric approach. Journal of Economic Perspectives, v. 107, n. 2, p. 87-106, 2017\.

OBSERVATÓRIO NACIONAL DE SEGURANÇA VIÁRIA (ONSV). Retrato da Segurança Viária no Brasil. Campinas: ONSV, 2023\.

RAASCH, C. DuckDB in Action: The Modern Analytical Database. 1\. ed. Nova York: Manning Publications, 2023\.

SILVA, R. A. et al. Uso de Sistemas de Informação em Saúde para Vigilância Epidemiológica de Acidentes de Trânsito no Brasil. Cadernos de Saúde Pública, Rio de Janeiro, v. 31, n. Sup 1, 2015\.

WHITE, Tom. Hadoop: The Definitive Guide. 4\. ed. Sebastopol: O'Reilly Media, 2015\. (Usado para contraponto de arquitetura Big Data).