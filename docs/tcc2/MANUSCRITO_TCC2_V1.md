# Mortalidade por acidentes de transporte terrestre nos municípios da Bahia de 2010 a 2024: análise espaço-temporal a partir do SIM

Thallys Viana Lemos, Andrique Figueiredo Amorim

Versão de trabalho de 5 de agosto de 2026. Este manuscrito organiza a primeira narrativa consistente do TCC II. Os resultados espaciais, a análise formal de tendência, o resumo e a conclusão ainda dependem das validações indicadas no diário metodológico. O texto não deve ser submetido nesta condição.

## Resumo provisório

Os acidentes de transporte terrestre constituem um importante problema de saúde pública e apresentam distribuição desigual entre grupos populacionais e territórios. Este estudo tem como objetivo analisar a evolução temporal e a distribuição municipal da mortalidade por acidentes de transporte terrestre na Bahia entre 2010 e 2024. Foi realizado um estudo ecológico, descritivo e analítico, com registros do Sistema de Informações sobre Mortalidade classificados nos códigos V01 a V89 da CID-10. A análise utilizou uma camada Silver nacional auditada, com distinção entre município de residência e município de ocorrência, além de dados populacionais e malhas municipais do IBGE. O filtro científico identificou 565.383 óbitos no Brasil e 37.906 óbitos ocorridos na Bahia no período. Entre os óbitos ocorridos no estado, 84,38% eram do sexo masculino e 59,66% estavam nas faixas de 15 a 44 anos. Em 45,10% dos registros, a residência não correspondia ao município de ocorrência ou não pôde ser determinada, evidenciando que os dois papéis geográficos não são intercambiáveis. Vitória da Conquista registrou 2.029 óbitos por ocorrência, dos quais 1.054 correspondiam a residentes de outros municípios. Os resultados preliminares mostram a necessidade de combinar tendências, estabilidade de taxas em pequenas populações, qualidade da causa básica e fluxos entre residência e ocorrência. A análise espacial e a estimação formal das tendências serão concluídas antes da versão final.

Palavras-chave: mortalidade; acidentes de transporte terrestre; Sistema de Informações sobre Mortalidade; análise espacial; municípios; Bahia.

## 1. Introdução

As mortes no trânsito permanecem entre as principais causas evitáveis de perda de vidas e afetam de maneira desproporcional homens, adultos jovens e usuários vulneráveis das vias. Embora o problema seja frequentemente apresentado por totais nacionais ou estaduais, sua ocorrência depende de condições territoriais, composição populacional, mobilidade e qualidade do registro. A escala municipal permite observar desigualdades que desaparecem em agregações amplas, mas também exige cuidados com pequenas contagens, flutuação aleatória e diferenças entre o local de residência da vítima e o local em que o óbito ocorreu.

No Brasil, o Sistema de Informações sobre Mortalidade, SIM, constitui uma das principais fontes para estudar mortes por acidentes de transporte terrestre. A causa básica da Declaração de Óbito permite selecionar os códigos V01 a V89 do Capítulo XX da CID-10. O sistema também registra o município de residência e o município de ocorrência. Esses campos respondem a perguntas distintas. A residência permite estimar o risco observado na população de um território, enquanto a ocorrência mostra onde os eventos fatais se concentram e pode refletir circulação rodoviária, centralidade regional e deslocamento de vítimas. A substituição de uma dimensão pela outra altera totais, taxas e interpretações.

Estudos brasileiros já mostraram que a mortalidade por acidentes de transporte terrestre apresenta padrões regionais e municipais heterogêneos. Morais Neto et al. (2012) identificaram crescimento das taxas entre 2000 e 2010, maior risco em municípios de menor porte e expansão de aglomerados no Nordeste. Sousa et al. (2020) analisaram residentes do Piauí entre 2000 e 2017 e encontraram aumento da mortalidade, principalmente entre motociclistas e ocupantes de veículos. Malta et al. (2023), em uma análise dos municípios brasileiros entre 2000 e 2018, observaram redução em parte do país e crescimento da mortalidade de motociclistas, com concentração de aglomerados no Norte, Nordeste e Centro-Oeste. Esses resultados mostram que a tendência nacional não representa de forma uniforme as diferentes regiões.

A literatura também indica que a categoria da vítima e a qualidade da causa básica precisam ser consideradas. Marín-León et al. (2012) utilizaram V89 como indicador de inadequação da informação sobre o veículo envolvido. Essa preocupação é relevante porque códigos inespecíficos podem representar parcela expressiva dos óbitos e alterar comparações entre motociclistas, pedestres e ocupantes de veículos. Além disso, taxas anuais brutas podem produzir rankings instáveis em municípios pequenos, tornando necessário agregar períodos, apresentar incerteza e aplicar técnicas de suavização antes de classificar áreas de maior risco.

Na Bahia, ainda é necessário consolidar uma análise municipal que combine série temporal recente, papéis de residência e ocorrência, qualidade do SIM e métodos adequados para pequenas áreas. O desenvolvimento anterior deste projeto concentrou-se na criação de um pipeline e de uma interface analítica. A auditoria posterior mostrou que erros silenciosos de reexecução, classificação de sexo e normalização geográfica podiam modificar os resultados. A reconstrução da camada Silver permitiu transformar a ferramenta em uma infraestrutura de evidência, na qual cada número pode ser relacionado ao arquivo de origem, ao filtro aplicado e à consulta executada.

Diante desse contexto, este estudo busca responder como a mortalidade por acidentes de transporte terrestre evoluiu e se distribuiu entre os municípios da Bahia de 2010 a 2024 e quais padrões persistentes, concentrações territoriais e desigualdades de risco podem ser identificados após a padronização pela população. O objetivo geral é analisar a evolução temporal e a distribuição espacial municipal da mortalidade por acidentes de transporte terrestre na Bahia. A análise parte do contexto nacional, caracteriza o perfil dos óbitos no estado, compara residência e ocorrência e investiga padrões municipais que mereçam aprofundamento.

## 2. Trabalhos relacionados e fundamentação

A análise municipal de mortalidade no trânsito no Brasil possui dois desafios recorrentes. O primeiro é epidemiológico. As taxas precisam representar uma população exposta compatível com o numerador, especialmente quando o município de residência é usado. O segundo é estatístico. Municípios pequenos podem apresentar valores extremos em razão de poucos eventos, de modo que o mapa de taxas brutas pode destacar flutuação aleatória em vez de risco persistente.

Morais Neto et al. (2012) analisaram a tendência nacional e a distribuição de aglomerados de risco por porte municipal. O estudo encontrou crescimento entre ocupantes de motocicletas e expansão de áreas de risco no Nordeste. A estratégia de comparar municípios por porte é particularmente útil para este trabalho, pois evita interpretar da mesma forma municípios com populações e volumes de óbitos muito diferentes.

O estudo de Sousa et al. (2020) aproxima-se do recorte proposto por utilizar o SIM, os códigos V01 a V89, município de residência, regressão de Prais-Winsten e médias trienais das taxas municipais. A escolha de períodos agregados reduz parte da instabilidade e oferece uma referência metodológica para a análise baiana. A aplicação à Bahia, entretanto, precisa incorporar a diferença entre residência e ocorrência e avaliar a persistência dos padrões em uma série que chega a 2024.

Malta et al. (2023) utilizaram taxas padronizadas por idade e períodos trienais para todos os municípios brasileiros, com atenção à mortalidade de motociclistas, porte populacional e condição econômica. O estudo reforça que a região Nordeste apresenta comportamento distinto e que a categoria de motociclista pode crescer mesmo quando a mortalidade total diminui. A comparação com esse resultado exigirá padronização etária ou, no mínimo, uma análise estratificada que evite atribuir à exposição diferenças produzidas pela composição da população.

Marín-León et al. (2012) distinguem dados de residência, usados em taxas da população de Campinas, e dados de ocorrência, usados na análise espacial dos acidentes fatais no município. Essa separação é central para o presente trabalho. O SIM não fornece uma única geografia correta para todas as perguntas. O papel territorial deve ser escolhido conforme o indicador e permanecer visível na tabela, na figura e no texto.

Para pequenas áreas, taxas brutas anuais não são suficientes. Métodos bayesianos empíricos e modelos espaço-temporais permitem reduzir a variabilidade aleatória por meio do compartilhamento de informação entre períodos ou áreas vizinhas. A versão final deverá justificar o estimador adotado, apresentar a matriz de vizinhança, tratar municípios sem vizinhos e manter as taxas brutas disponíveis para auditoria. A suavização não deve ocultar os numeradores nem substituir a análise de qualidade.

## 3. Metodologia

### 3.1 Desenho e unidade de análise

Trata-se de um estudo ecológico, descritivo e analítico, com série temporal de 2010 a 2024. A unidade espacial é o município e a unidade temporal principal é o ano. O recorte científico inclui os 417 municípios da Bahia. Os dados nacionais e estaduais são utilizados para contextualizar a posição da Bahia, mas a investigação espacial se concentra no território baiano.

### 3.2 Fontes de dados

Os registros de óbito foram obtidos do SIM, disponibilizado pelo DATASUS. A extração nacional compreende 27 unidades da Federação e 15 anos. Os dados brutos foram preservados em arquivos Parquet na camada Bronze. Uma camada Silver de contrato conserva uma linha por registro recebido, campos brutos, chaves de linhagem, identificador único e indicadores de qualidade. Duas tabelas Gold agregam os registros por município e mês, uma pelo papel de ocorrência e outra pelo papel de residência.

Os códigos, nomes e a malha municipal foram obtidos do IBGE. As populações municipais foram consultadas no SIDRA. Para 2010 foi utilizada a população residente do Censo Demográfico, Tabela 202 e variável 93. Para 2011 a 2021 e 2024 foram usadas as estimativas da população residente em 1º de julho, Tabela 6579 e variável 9324. Para 2022 foi usada a população residente do Censo Demográfico, Tabela 4709 e variável 93. Não foi atribuído denominador anual a 2023 nesta versão, pois a relação publicada naquele ano corresponde à população censitária de referência de 2022 com atualização territorial.

Não foram utilizadas taxas por frota. A auditoria mostrou que o repositório ainda não contém um arquivo real da SENATRAN com competência, tipo de veículo, código municipal, origem e hash. A ausência foi preservada como valor indisponível.

### 3.3 Definição do desfecho

Foram incluídos registros não fetais cuja causa básica pertence ao intervalo V01 a V89 da CID-10. O filtro executado na Silver foi `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. A data do óbito deveria estar compreendida entre 1º de janeiro de 2010 e 31 de dezembro de 2024. A análise preservou sexo ignorado, idade ignorada e geografia não encontrada como categorias explícitas.

O campo apresentado no sistema como `tipo_veiculo` foi derivado do grupo CID. Ele representa principalmente a condição da vítima no transporte, como pedestre, ciclista, motociclista ou ocupante de automóvel. Ele não informa todos os veículos envolvidos e será referido no artigo como categoria da vítima derivada da CID-10. Os grupos V09, V29, V49 e V89 serão apresentados separadamente para avaliar a proporção de informação inespecífica.

### 3.4 Papéis geográficos

O município de residência foi definido pelo campo `CODMUNRES`. O município de ocorrência foi definido por `CODMUNOCOR`. Ambos foram normalizados para o código IBGE de sete dígitos, com preservação do valor bruto e do código de seis dígitos usado pelo SIM. Registros sem correspondência não foram descartados silenciosamente.

A taxa principal por 100 mil habitantes será calculada pelo número de óbitos de residentes do município dividido pela população do mesmo município e ano. A ocorrência será analisada em contagens e em taxa territorial bruta, quando necessário, com indicação de que o denominador populacional não representa a população efetivamente exposta ao trânsito no local.

Os fluxos foram definidos no nível do registro, mantendo o par residência e ocorrência. Para um município de ocorrência, foram calculados o total de vítimas residentes no próprio município, em outro município baiano, em outra UF ou com geografia não encontrada. A análise inversa foi feita para residentes de um município que morreram dentro ou fora dele.

### 3.5 Análise temporal e espacial

A análise descritiva compreende totais anuais, variação relativa, distribuição mensal e perfil por sexo, faixa etária e grupo CID. A versão final deverá estimar tendências com método apropriado para autocorrelação temporal e apresentar variação percentual anual com intervalo de confiança. A regressão simples calculada na EDA não será usada como resultado final.

No nível municipal, serão produzidas taxas anuais e taxas agrupadas em períodos. A estabilidade será avaliada pelo número de eventos, pela população e pela persistência em estratos de risco. Taxas brutas serão comparadas com estimativas suavizadas. A análise espacial deverá usar a malha municipal do IBGE e uma matriz de contiguidade documentada. O índice de Moran global avaliará autocorrelação espacial, enquanto indicadores locais poderão identificar agrupamentos, desde que sejam aplicadas permutações e correção para múltiplos testes.

### 3.6 Reprodutibilidade e qualidade

As consultas foram executadas com DuckDB 1.4.4 no WSL. Cada entrada foi registrada por caminho, tamanho e SHA-256. O protocolo SQL e o executor estão versionados em `analysis/tcc2`. Os resultados possuem manifesto com data, versão do motor, filtro, hashes, número de linhas e amostra. As Gold foram reconciliadas com a Silver por ano, UF e papel geográfico.

A camada Bronze continha cópias redundantes de arquivos produzidas por reexecuções antigas. Por isso, ela não foi concatenada diretamente para formar o numerador. A Silver canônica foi construída a partir de 405 fontes distintas identificadas por conteúdo. O identificador de registro combina a fonte e a posição da linha, permitindo verificar unicidade sem eliminar declarações apenas porque compartilham atributos.

### 3.7 Aspectos éticos

O estudo utiliza dados públicos, anonimizados e sem identificação direta. Não houve contato com participantes nem coleta primária. Os resultados do artigo e da aplicação serão agregados. Identificadores técnicos de linha não serão expostos na interface ou nas tabelas de divulgação.

## 4. Resultados preliminares

### 4.1 Cobertura e qualidade da base

A Silver nacional contém 20.410.620 registros e o mesmo número de identificadores distintos. O filtro científico selecionou 565.383 óbitos por acidentes de transporte terrestre. A série anual variou de 42.844 óbitos em 2010 a 37.150 em 2024. O menor total foi observado em 2019, com 31.945 registros.

A auditoria física identificou 557 arquivos e 29.789.768 linhas no diretório Bronze, embora existam 405 combinações de UF e ano. A diferença decorre de cópias redundantes geradas por reexecuções antigas. A materialização Silver removeu a redundância no nível do arquivo de origem e manteve 20.410.620 registros únicos. As duas Gold reconciliaram integralmente com a Silver filtrada.

A dimensão populacional anteriormente consumida pelo produto era incompleta. Na Bahia, continha entre 325 e 373 municípios conforme o ano. A nova extração em lote do SIDRA alcançou os 417 municípios em 2010, de 2011 a 2022 e em 2024. O ano de 2023 foi mantido sem taxa. Essa correção altera a confiabilidade de rankings e mapas e precisa ser promovida ao pipeline antes da versão final da ferramenta.

### 4.2 Brasil e Bahia

Na Bahia, foram identificados 37.906 óbitos pelo município de ocorrência e 37.242 pelo município de residência entre 2010 e 2024. A diferença mostra que os totais não podem ser apresentados sem a dimensão territorial. Em 2023, ocorreram 2.838 óbitos no estado, enquanto 2.723 correspondiam a residentes baianos. Em 2024, os valores foram 3.105 e 3.012, respectivamente.

O total nacional passou de 34.881 em 2023 para 37.150 em 2024. Na Bahia, a ocorrência passou de 2.838 para 3.105. Em contagens absolutas por ocorrência, a Bahia ocupava a quinta posição nacional em 2010, a quarta entre 2016 e 2022 e a terceira em 2023 e 2024. Sua participação passou de 6,10% dos registros com UF conhecida em 2010 para 8,36% em 2024. A taxa entre residentes baianos foi de 20,28 por 100 mil em 2024, maior valor entre os 14 anos com denominador desta extração. Esses resultados são descritivos e não constituem uma tendência. A posição por contagem não equivale a risco, e a estimação formal deverá considerar toda a série, a população, as mudanças de denominador e a possibilidade de atualização tardia do SIM.

### 4.3 Perfil dos óbitos ocorridos na Bahia

Entre os 37.906 óbitos ocorridos na Bahia, 31.985 eram do sexo masculino, equivalentes a 84,38%. As faixas de 25 a 34 anos, 35 a 44 anos e 15 a 24 anos concentraram 22,31%, 19,89% e 17,46% dos registros. Em conjunto, as pessoas entre 15 e 44 anos responderam por 59,66% do total.

As categorias derivadas da CID foram automóvel, com 30,30%, motociclista, com 26,94%, outros, com 25,13%, e pedestre, com 13,63%. Essa distribuição precisa ser interpretada junto aos grupos CID. V49 respondeu por 23,77%, V89 por 22,34%, V29 por 15,55% e V09 por 10,20%. A concentração em códigos terminados em 9 mostra que parte relevante da classificação permanece inespecífica. Assim, a categoria agregada não deve ser descrita como se identificasse com precisão todos os veículos envolvidos.

A distribuição mensal apresentou maior participação em dezembro, com 9,57%, e menor em fevereiro, com 7,56%. A comparação ainda não foi ajustada pelo número de dias de cada mês nem pela composição anual da série, portanto permanece exploratória.

### 4.4 Residência, ocorrência e Vitória da Conquista

Dos óbitos ocorridos na Bahia, 20.809, ou 54,90%, correspondiam a pessoas que residiam no mesmo município. Outros 14.128, ou 37,27%, eram de residentes de outro município baiano. Foram identificadas 2.432 vítimas residentes em outra UF, equivalentes a 6,42%, e 537 registros com geografia não encontrada em um dos papéis.

Vitória da Conquista registrou 2.029 óbitos por ocorrência entre 2010 e 2024. Desse total, 1.054 vítimas residiam em outro município, o que corresponde a 51,95%. As principais origens externas incluíram Poções, Itapetinga, Barra do Choça, Planalto, Cândido Sales e Brumado. No sentido inverso, foram identificados 1.213 óbitos de residentes de Vitória da Conquista, dos quais 238 ocorreram fora do município, proporção de 19,62%.

Em 2024, ocorreram 156 óbitos em Vitória da Conquista. Oitenta vítimas residiam em outro município, proporção de 51,28%. No mesmo ano, foram registrados 102 óbitos de residentes do município, dos quais 26 ocorreram fora. A assimetria entre entrada e saída sugere centralidade regional, mas o SIM não permite afirmar se o deslocamento decorreu de viagem, rodovia, transferência hospitalar ou outra circunstância. O achado deve ser contextualizado com a rede viária e fontes locais antes de receber explicação.

### 4.5 Padrões municipais em investigação

A primeira classificação por taxa territorial bruta de ocorrência apontou persistência de Irecê, Santo Antônio de Jesus, Guanambi, Vitória da Conquista, Jequié, Alagoinhas e Itabela no quartil superior em todos os 14 anos com denominador. Esse resultado não será apresentado como mapa de risco antes da repetição por residência, da agregação temporal e da suavização das taxas.

Duas situações ilustram a necessidade de aprofundamento. Barreiras apresentou de zero a dez óbitos anuais por ocorrência entre 2010 e 2015 e 92 em 2016. A série por residência também passou de três em 2015 para 30 em 2016. Os valores posteriores permaneceram elevados. A linhagem confirmou arquivos, códigos municipais e registros distintos, mas ainda não explica a ruptura. Gavião registrou 20 óbitos por ocorrência em 2024, o que produziu taxa bruta de 445,14 por 100 mil habitantes em uma população estimada de 4.493 pessoas. Todos os registros possuíam data de 7 de janeiro. Dezesseis vítimas residiam em Jacobina, três em Juazeiro e uma em Jaguarari. Os códigos da causa básica incluíam ocupantes de ônibus e de veículo pesado. Uma nota do Departamento de Polícia Técnica da Bahia sobre a mesma data e região registrou a colisão entre um caminhão e um micro-ônibus e informou 23 mortes. A convergência identifica um evento catastrófico específico como origem do extremo, embora a diferença entre os universos de contagem ainda precise ser reconciliada. Barreiras permanecerá como pista até reprodução externa, enquanto Gavião passa a exemplificar como um único evento pode dominar a taxa anual de uma pequena área.

## 5. Discussão preliminar

Os resultados mostram que a escala municipal acrescenta informação relevante à análise estadual, mas também expõe problemas que não aparecem nos totais. A diferença entre residência e ocorrência não é residual. Quase metade dos óbitos ocorridos na Bahia envolve outro município de residência ou geografia não encontrada. Em Vitória da Conquista, a entrada de vítimas de outros municípios supera a saída de residentes que morreram fora. Esse padrão confirma a necessidade de manter os dois papéis no sistema e impede o uso de uma única Gold municipal para todas as perguntas.

O predomínio masculino e a concentração entre 15 e 44 anos são coerentes com estudos brasileiros de mortalidade no trânsito. A comparação detalhada por categoria da vítima, entretanto, depende da qualidade da causa básica. A participação de V49 e V89 é suficientemente alta para afetar a distribuição entre automóveis, motociclistas e outros grupos. O artigo deve discutir o perfil observado sem tratar a classificação como descrição completa do acidente.

A série nacional mostra redução até 2019 e crescimento posterior, com 37.150 registros em 2024. A Bahia também apresenta aumento nos anos recentes. Ainda não é possível afirmar mudança de tendência, pois a análise exige modelo temporal, intervalo de confiança e avaliação do efeito de atualização do SIM. A comparação com publicações oficiais deve reproduzir o mesmo universo, incluindo dimensão geográfica, filtro CID, data de atualização e tratamento dos registros não fetais.

Os resultados municipais reforçam a fragilidade dos rankings anuais. A taxa de Gavião em 2024 é matematicamente correta para o numerador e o denominador adotados, mas foi dominada por um acidente catastrófico e não demonstra risco persistente. O caso não deve ser apagado pela suavização, pois constitui um evento real e relevante, mas também não pode ser interpretado como exposição estrutural sem a série histórica. A versão final deverá apresentar o valor bruto para transparência, o contexto do evento e uma estimativa temporalmente estabilizada para comparação territorial.

A ruptura em Barreiras pode se tornar uma descoberta metodológica relevante. Se for confirmada como mudança de cobertura ou classificação, demonstrará como a qualidade local do registro altera mapas e tendências. Se for confirmada como mudança real, exigirá contextualização territorial e temporal. Em nenhuma das hipóteses a explicação deve ser escolhida a partir do formato da série.

## 6. O produto como infraestrutura de evidência

O software desenvolvido no projeto não constitui a pergunta científica. Sua função é garantir que as evidências possam ser reproduzidas, consultadas e exportadas. O pipeline preserva os arquivos recebidos, mantém uma Silver com linhagem e qualidade, materializa Gold separadas por residência e ocorrência e expõe agregações para tabelas, gráficos e mapas.

A interface deve permitir filtros por período, localidade, papel geográfico, sexo, faixa etária e categoria da vítima. Cada visualização precisa apresentar fonte, data de atualização, filtros e disponibilidade de denominadores. Municípios sem óbitos devem permanecer no mapa com preenchimento neutro. Taxas devem ficar indisponíveis quando o denominador não existir. Relatórios e exportações devem conservar os metadados necessários para uso como evidência no artigo.

A avaliação do produto será baseada na reconciliação dos totais, na consistência entre API e consulta SQL, na exibição correta de todos os polígonos, na resposta dos filtros e na reprodução de tabelas do artigo. Funcionalidades fora do escopo, como custos do SIA e previsão TimesFM, não serão usadas para justificar a contribuição desta versão.

## 7. Limitações

O SIM depende do preenchimento da Declaração de Óbito e da classificação da causa básica. Sub-registro, causas inespecíficas e diferenças de qualidade entre municípios podem afetar os resultados. O registro de ocorrência identifica o município do óbito, mas não contém a trajetória completa do acidente, da remoção e do atendimento.

As taxas populacionais utilizam censos e estimativas produzidos por métodos diferentes ao longo do período. A comparação histórica deve reconhecer revisões e alterações territoriais. O ano de 2023 permanece sem denominador anual exato nesta versão. A população residente não mede circulação, volume de tráfego, quilômetros percorridos ou população flutuante.

As análises apresentadas são preliminares e utilizam taxas brutas. Ainda não foram aplicadas padronização por idade, suavização, regressão temporal definitiva ou testes de autocorrelação espacial. Os achados municipais não devem orientar decisão pública antes dessas etapas e da avaliação de estabilidade.

## 8. Conclusão provisória

A reconstrução auditável do SIM mostrou que a mortalidade por acidentes de transporte terrestre na Bahia não pode ser descrita de forma adequada por um único total municipal. Residência e ocorrência produzem leituras complementares, e os fluxos revelam relações territoriais relevantes, como a concentração de vítimas não residentes em Vitória da Conquista. O perfil observado é predominantemente masculino e concentrado em adultos jovens, ao mesmo tempo em que uma parcela expressiva dos códigos CID permanece inespecífica.

A primeira EDA também identificou limites concretos para a interpretação de taxas municipais, incluindo denominadores incompletos no pipeline anterior, valores extremos em pequenas populações e rupturas temporais que exigem auditoria. A próxima etapa deverá estabilizar as taxas, estimar tendências e testar padrões espaciais. A contribuição esperada não é apenas apresentar um mapa, mas construir uma análise municipal cuja evidência possa ser reproduzida e cuja incerteza permaneça visível.

## Referências provisórias verificadas

BAHIA. Departamento de Polícia Técnica. Nota: Polícia Técnica, acidente entre caminhão e micro-ônibus em Gavião. Salvador, 9 jan. 2024. Disponível em: https://www.ba.gov.br/policiatecnica/noticia/2024-04/940/nota-policia-tecnica-acidente-entre-caminhao-e-micro-onibus-em-gaviao. Acesso em: 4 ago. 2026.

MALTA, Deborah Carvalho et al. Mortality by road transport injury in Brazilian municipalities between 2000 and 2018. Public Health, v. 220, p. 120-126, 2023. DOI: 10.1016/j.puhe.2023.04.013.

MARÍN-LEÓN, Leticia et al. Tendência dos acidentes de trânsito em Campinas, São Paulo, Brasil: importância crescente dos motociclistas. Cadernos de Saúde Pública, v. 28, n. 1, 2012. DOI: 10.1590/S0102-311X2012000100005.

MORAIS NETO, Otaliba Libânio de et al. Mortalidade por acidentes de transporte terrestre no Brasil na última década: tendência e aglomerados de risco. Ciência & Saúde Coletiva, v. 17, n. 9, 2012. DOI: 10.1590/S1413-81232012000900002.

SOUSA, Roniele Araújo de et al. Tendência temporal e distribuição espacial da mortalidade por acidentes de trânsito no Piauí, 2000-2017. Epidemiologia e Serviços de Saúde, v. 29, n. 5, 2020. DOI: 10.1590/S1679-49742020000500005.
