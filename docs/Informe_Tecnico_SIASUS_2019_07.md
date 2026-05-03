## Divisão de Análise e Administração de Dados – DIAAD

# DISSEMINAÇÃO DE DADOS EM SAÚDE

# SISTEMA DE INFORMAÇÕES AMBULATORIAIS DO SUS - SIASUS

## INFORME TÉCNICO

- 1. APRESENTAÇÃO Sumário
   - 1.1. INFORMAÇÕES GERAIS
- 2. ARQUIVO DE PROCEDIMENTOS AMBULATORIAIS
   - 2.1. INFORMAÇÕES GERAIS
   - 2.2. MUDANÇAS OCORRIDAS NOS ARQUIVOS DE PRODUÇÃO AMBULATORIAL
   - 2.3. LAYOUT DO ARQUIVO DE PRODUÇÃO AMBULATORIAL: PAUFAAMM.DBF
- 3. ARQUIVOS DE AUTORIZAÇÕES DE PROCEDIMENTOS AMBULATORIAIS - APAC
   - 3.1. INFORMAÇÕES GERAIS
   - 3.2. NOMENCLATURA DOS ARQUIVOS DE APAC
   - 3.3. MUDANÇAS OCORRIDAS NOS ARQUIVOS DE APAC
   - 3.4. LAYOUT DOS ARQUIVOS DE APAC
   - 3.4.1. LAYOUT DO ARQUIVO DE LAUDOS DIVERSOS: ADUFAAMM.DBF
   - 3.4.2. LAYOUT DO ARQUIVO DE APAC DE MEDICAMENTOS: AMUFAAMM.DBF
   - 3.4.3. LAYOUT DO ARQUIVO DE APAC DE NEFROLOGIA: ANUFAAMM.DBF
   - 3.4.4. LAYOUT DO ARQUIVO DE APAC DE QUIMIOTERAPIA: AQUFAAMM.DBF
   - 3.4.5. LAYOUT DO ARQUIVO DE APAC DE RADIOTERAPIA: ARUFAAMM.DBF
   - 3.4.6. LAYOUT DO ARQUIVO DE APAC DE CIRURGIA BARIÁTRICA: ABUFMM.DBF
   - 3.4.7. LAYOUT DO ARQUIVO DE APAC DE CONFECÇÃO DE FÍSTULA ARTERIOVENOSA: ACFUFMM.DBF
   - 3.4.8. LAYOUT DO ARQUIVO DE APAC DE TRATAMENTO DIALÍTICO: ATDUFMM.DBF
- 4. REGISTRO DAS AÇÕES AMBULATORIAIS DE SAÚDE - RAAS
   - 4.1. LAYOUT DO ARQUIVO DE ATENÇÃO DOMICILIAR: SAD*.DBF
   - 4.2. LAYOUT DO ARQUIVO DE RAAS – PSICOSSOCIAL: PS*.DBF
- 5. BOLETIM DE PRODUÇÃO AMBULATORIAL INDIVIDUALIZADO – BPA-I
   - 5.1. INFORMAÇÕES GERAIS
   - 5.2. LAYOUT DO ARQUIVO DE BPA-I: BIUFAAMM.DBF
- 6. FORMAS DE CONTATO COM O DATASUS


Divisão de Análise e Administração de Dados – DIAAD

## 1. APRES EN TAÇÃO

### 1.1. INFORMAÇÕES GERAIS

### Todas as informações produzidas ou sob guarda do poder público são públicas e, portanto, acessíveis a todos os

### cidadãos, ressalvadas as informações pessoais e as hipóteses de sigilo legalmente estabelecidas.

### As informações em saúde que são disseminadas por intermédio da publicação de arquivos hospedados em

### servidores de acesso público no DATASUS têm por objetivo atender a divulgação proativa (transparência ativa), já

### que são de interesse coletivo e geral, em conformidade com o art. 8º da Lei n.º 12.527, de 18 de novembro de

### 2011 (Lei de Acesso à Informação^1 ), possibilitando a qualquer pessoa, física ou jurídica, sua consulta.

### Os arquivos disponibilizados são gerados em formato dbf^2 e compactados no formato dbc^3 , podendo ser tabulados

### diretamente com o TABWIN.

## 2. ARQUIVO DE PROCEDIMENTOS AMBULATORIAIS

### 2.1. INFORMAÇÕES GERAIS

### PAufaamm.dbf

### PA – Sigla de identificação do arquivo de Procedimento Ambulatorial

### uf – sigla da Unidade da Federação

### aa – ano da competência

### mm – mês da competência

### As informações contidas nos arquivos de Procedimentos Ambulatoriais (PA), obtidas após o processamento do

### Sistema de Informação Ambulatorial (SIASUS), referem-se aos Atendimentos Ambulatoriais realizados nas

### respectivas competências (ano e mês), a partir de janeiro de 2008, data da implantação da Tabela de

### Procedimentos, Medicamentos, Órteses e Próteses e Materiais Especiais – OPM do SUS, instituída pela Portaria

### GM/MS n.º 321 de 08 de fevereiro de 2007^4.

### Dentro do arquivo PAufaamm.dbf constam dados dos procedimentos ambulatoriais obtidos através dos seguintes

### instrumentos de registro do SIASUS:

###  APAC: Autorização de Procedimentos Ambulatoriais de Alta Complexidade

###  BPA-C: Boletim de Produção Ambulatorial Consolidado

###  BPA-I: Boletim de Produção Ambulatorial Individualizado

###  RAAS-AD: Registro das Ações Ambulatoriais de Saúde - Atenção Domiciliar

###  RAAS-PSI: Registro das Ações Ambulatoriais de Saúde - Atenção Psicossocial

### O preenchimento dos campos de cada registro do arquivo PA varia conforme o tipo de instrumento que o

### originou, o que é identificado pelo conteúdo do campo PA_DOCORIG. Assim, quando o campo estiver preenchido

### com:

(^1) [http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm](http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm)
(^2) Arquivos com a extensão _dbf_ são arquivos oriundos de sistemas de gerenciamento de dados. A extensão dbf significa “Data Base File”, ou seja, arquivo

### de base de dados, que contém os registros e campos de dados de um sistema de informação.

(^3) O TABWIN possui uma facilidade que comprime arquivos de dados no formato dbf para que se tornem menores e ocupem menos espaço em disco. Os

### arquivos comprimidos recebem a extensão dbc. A função COMPRIME/EXPANDE dbf faz essa função no TABWIN.

(^4) A Portaria GM/MS n.º 321 (de 08 de fevereiro de 2007) indicava a competência julho de 2007 para a implantação da Tabela, posteriormente prorrogada
para janeiro de 2008 pela Portaria GM/MS nº 1.541 de 27 de junho de 2007.


Divisão de Análise e Administração de Dados – DIAAD

###  “P”, o registro representa os dados do procedimento principal lançado por meio de uma APAC e “S” para

### os dados do procedimento secundário;

###  “C”, o registro representa os dados dos procedimentos obtidos por intermédio do BPA-C;

###  “A”, o registro representa os dados dos procedimentos obtidos por intermédio do RAAS-AD;

###  “B”, o registro representa os dados dos procedimentos obtidos por intermédio do RAAS – Psicossocial; e,

###  “I”, o registro representa os dados dos procedimentos obtidos por intermédio do BPA - Individualizado.

### A quantidade de registros (linhas) varia conforme o tipo de instrumento. A saber:

### i. Um instrumento BPA-C gera diversos registros no arquivo PA: um para cada par [código de

### procedimento, CBO], correspondendo à respectiva linha no instrumento original em papel^5 ;

### ii. Um instrumento BPA-I gera diversos registros no arquivo de PA: um para cada atendimento. Há

### casos de registros de um ou mais atendimentos no BPA-I para o mesmo paciente. Neste caso, pode-

### se, inclusive, repetir o número da autorização dada pelo gestor de saúde. No BPA-I, este campo é

### não-obrigatório e, portanto, não é criticado. Assim, devem ser consideradas as limitações quanto à

### qualidade do seu preenchimento, caso este campo seja utilizado para algum tipo de controle;

### iii. Um instrumento APAC gera diversos registros no arquivo PA: um para cada código de procedimento

### realizado na APAC, seja ele procedimento principal (P) ou secundário (S).

### 2.2. MUDANÇAS OCORRIDAS NOS ARQUIVOS DE PRODUÇÃO AMBULATORIAL

### Inclusão de novas variáveis de localização dos municípios de atendimento e residência nos arquivos de

### definição.

### 2.3. LAYOUT DO ARQUIVO DE PRODUÇÃO AMBULATORIAL: PAUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 PA_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)^6
```
```
2 PA_GESTAO CHAR (6)
Código da Unidade da Federação^7 (IBGE) + Código do Município (IBGE) do Gestor, ou UF0000 se o
estabelecimento estiver sob Gestão Estadual
3 PA_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
4 PA_UFMUN CHAR (6) Unidade da Federação + Código do Município onde está localizado o estabelecimento
5 PA_REGCT CHAR (4) Código da Regra Contratual
6 PA_INCOUT CHAR (4) Incremento Outros
7 PA_INCURG CHAR (4) Incremento Urgência
8 PA_TPUPS CHAR (2) Tipo de Estabelecimento
9 PA_TIPPRE CHAR (2) Tipo de Prestador
10 PA_MN_IND CHAR (1) Estabelecimento Mantido / Individual
11 PA_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
12 PA_CNPJMNT CHAR (14) CNPJ da Mantenedora do estabelecimento ou zeros, caso não a tenha
13 PA_CNPJ_CC CHAR (14) CNPJ do Órgão que recebeu pela produção por cessão de crédito ou zeros, caso não o tenha
```
### 14 PA_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)

```
15 PA_CMP CHAR (6) Data da Realização do Procedimento / Competência (AAAAMM)
16 PA_PROC_ID CHAR (10) Código do Procedimento Ambulatorial
17 PA_TPFIN CHAR (2) Tipo de Financiamento da produção
18 PA_SUBFIN CHAR (4) Subtipo de Financiamento da produção
```
(^5) Consulte os formatos dos instrumentos de registro nos links abaixo:
BPA-C: ftp://ftp.datasus.gov.br/siasus/Documentos/BPA-CONSOLIDADO_20122007.pdf
BPA-I: ftp://ftp.datasus.gov.br/siasus/documentos/BPA-INDIVIDUALIZADO_15122007.pdf^
(^6) O Banco de Dados Nacional de Estabelecimentos de Saúde (SCNES) foi instituído pela Portaria MS/SAS n.º 376, de 03 de outubro de 2000, publicada no

### Diário Oficial da União de 04 de outubro de 2000. A Portaria MS/SAS n.º 511, de 29 de dezembro de 2000 (republicada com correções no DOU 117-E, de

19 de junho de 2001), normatizou o SCNES. O Cadastro Nacional de Estabelecimentos de Saúde (CNES) foi instituído pela Portaria MS n.º 1646, de 2 de

### outubro de 2015.

(^7) Tabela de Códigos de Áreas da organização do território, elaborada pelo IBGE, que apresenta a lista dos estados e municípios brasileiros associados a um
código composto de 7 dígitos, sendo os dois primeiros referentes ao código do estado (UF). Acessada em: [http://concla.ibge.gov.br/classificacoes/por-](http://concla.ibge.gov.br/classificacoes/por-)
tema/codigo-de-areas/codigo-de-areas


Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
19 PA_NIVCPL CHAR (1) Complexidade do Procedimento
20 PA_DOCORIG CHAR (1) Instrumento de Registro (conforme explicado na página 2)
```
#### 21 PA_AUTORIZ CHAR (13)

```
Número da APAC ou número de autorização do BPA-I, conforme o caso. No BPA-I, não é obrigatório,
portanto, não é criticado.
Lei de formação: UFAATsssssssd, onde:
UF – Unid. da Federação, AA – ano, T – tipo, sssssss – sequencial, d – dígito
22 PA_CNSMED CHAR (15) Número do CNS (Cartão Nacional de Saúde) do profissional de saúde executante
23 PA_CBOCOD CHAR (6) Código da Ocupação do profissional na Classificação Brasileira de Ocupações^8 (Ministério do Trabalho)
24 PA_MOTSAI CHAR (2) Motivo de saída ou zeros, caso não tenha
25 PA_OBITO CHAR (1) Indicador de Óbito (APAC)
26 PA_ENCERR CHAR (1) Indicador de Encerramento (APAC)
27 PA_PERMAN CHAR (1) Indicador de Permanência (APAC)
28 PA_ALTA CHAR (1) Indicador de Alta (APAC)
29 PA_TRANSF CHAR (1) Indicador de Transferência (APAC)
30 PA_CIDPRI CHAR (4) CID^9 Principal (APAC ou BPA-I)
31 PA_CIDSEC CHAR (4) CID Secundário (APAC)
32 PA_CIDCAS CHAR (4) CID Causas Associadas (APAC)
33 PA_CATEND CHAR (2) Caráter de Atendimento (APAC ou BPA-I)
34 PA_IDADE CHAR (3) Idade do paciente em anos
36 IDADEMIN CHAR (3) Idade mínima do paciente para realização do procedimento
37 IDADEMAX CHAR (3) Idade máxima do paciente para realização do procedimento
```
#### 35 PA_FLIDADE CHAR (1)

```
Compatibilidade com a faixa de idade do procedimento (SIGTAP – Sistema de Gerenciamento da Tabela de
Procedimentos do SUS):
0 = Idade não exigida; 1 = Idade compatível com o SIGTAP; 2 = Idade fora da faixa do SIGTAP; 3 = Idade
inexistente; 4 = Idade EM BRANCO
38 PA_SEXO CHAR (1) Sexo do paciente
39 PA_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
```
```
40 PA_MUNPCN CHAR (6)
Código da Unidade da Federação + Código do Município de residência do paciente ou do estabelecimento,
caso não se tenha a identificação do paciente, o que ocorre no (BPA)
41 PA_QTDPRO NUMERIC (11) Quantidade Produzida (APRESENTADA)
42 PA_QTDAPR NUMERIC (11) Quantidade Aprovada do procedimento
43 PA_VALPRO NUMERIC (20,2) Valor Produzido (APRESENTADO)
44 PA_VALAPR NUMERIC (20,2) Valor Aprovado do procedimento
```
```
45 PA_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento:
0 = mesma UF; 1 = UF diferente
46 PA_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento:
0 = mesmo município; 1 = município diferente
47 PA_DIF_VAL NUMERIC (20,2)
Diferença do Valor Unitário do procedimento praticado na Tabela Unificada com Valor Unitário praticado
pelo Gestor da Produção, multiplicado pela Quantidade Aprovada
48 NU_VPA_TOT NUMERIC (20,2) Valor Unitário do Procedimento da Tabela VPA
49 NU_PA_TOT NUMERIC (20,2) Valor Unitário do Procedimento da Tabela SIGTAP
```
```
50 PA_INDICA CHAR (1) Indicativo de situação da produção produzida:^
0 = não aprovado; 5 = aprovado total; 6 = aprovado parcial
51 PA_CODOCO CHAR (1) Código de Ocorrência
52 PA_FLQT CHAR (1) Indicador de erro de Quantidade Produzida
53 PA_FLER CHAR (1) Indicador de erro de corpo da APAC
54 PA_ETNIA CHAR (4) Etnia do paciente
55 PA_VL_CF NUMERIC (20,2) Valor do Complemento Federal
56 PA_VL_CL NUMERIC (20,2) Valor do Complemento Local
57 PA_VL_INC NUMERIC (20,2) Valor do Incremento
58 PA_SRC_C CHAR(6) Código do Serviço Especializado / Classificação CBO (de acordo com o CNES)
```
```
59 PA_INE CHAR(10),
Código de Identificação Nacional de Equipes^10 , para registrar a atuação das equipes na execução de ações de
saúde
```
(^8) Classificação Brasileira de Ocupações - CBO, instituída por portaria do Ministério do Trabalho e Emprego – TEM, nº. 397, de 9 de outubro de 2002.
(^9) Classificação Estatística Internacional de Doenças e Problemas Relacionados com a Saúde, frequentemente designada pela sigla CID, publicada pela

### Organização Mundial de Saúde (OMS).

(^10) Vide Cadastramento das equipes da Atenção Básica no Cadastro Nacional de Estabelecimentos de Saúde (CNES), Portaria n.º 18, de 7 de janeiro de
2019, publicada no DOU em 10/01/2019.


Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
60 PA_NAT_JUR CHAR(4) Código da Natureza Juridica^11
```
## 3. ARQUIVOS DE AUTORIZAÇÕES DE PROCEDIMENTOS AMBULATORIAIS - APAC

### 3.1. INFORMAÇÕES GERAIS

### As informações contidas nestes arquivos referem-se aos Atendimentos Ambulatoriais realizados em pacientes

### submetidos à APAC, nas respectivas competências (ano e mês), a partir de janeiro de 2008, data da implantação da

### Tabela de Procedimentos, Medicamentos, Órteses e Próteses e Materiais Especiais – OPM do Sistema Único de

### Saúde – SUS, instituída pela Portaria GM/MS n.º 321 de 08 de fevereiro de 2007.

### O instrumento APAC gera diversos registros no arquivo de disseminação: um registro para cada código de

### procedimento realizado na APAC, seja ele o procedimento principal ou procedimentos secundários. Nos arquivos

### de APAC, o procedimento contido no arquivo refere-se ao procedimento principal.

### O valor aprovado contido nos arquivos de APAC refere-se ao valor total da APAC.

### O incremento frequência mostrado ao tabular os arquivos de APAC refere-se ao Total de APAC.

### Os arquivos de APAC são compostos conforme o Tipo de Laudo (Tipo de Atendimento) de APAC. Os laudos de

### APAC são:

###  Laudos Diversos (sigla AD)

###  Laudo de Medicamentos (AM)

###  Laudo de Nefrologia (AN)

###  Laudo de Quimioterapia (AQ)

###  Laudo de Radioterapia (AR)

###  Laudo de Acompanhamento à Cirurgia Bariátrica (AB)

###  Laudo de Confecção de Fístula (ACF)

###  Laudo de Tratamento Dialítico (ATD)

###  Laudo de Acompanhamento Multiprofissional (AMP)

### 3.2. NOMENCLATURA DOS ARQUIVOS DE APAC

### Laudos Diversos – ADufaamm.dbf

### Laudo de Medicamentos – AMufaamm.dbf

### Laudo de Nefrologia – ANufaamm.dbf

### Laudo de Quimioterapia – AQufaamm.dbf

### Laudo de Radioterapia – ARufaamm.dbf

### Laudo de Acompanhamento a Cirurgia Bariátrica – ABufaamm.dbf

### Laudo de Confecção de Fístula (ACF) – ACFufaamm.dbf

### Laudo de Tratamento Dialítico (ATD) – ATDufaamm.dbf

### Laudo de Acompanhamento Multiprofissional (AMP) – AMPufaamm.dbf

### Sendo: uf – sigla da Unidade da Federação; aa – ano da competência; mm – mês da competência

(^11) Para Natureza Jurídica, a informação é proveniente do CNES, que utiliza exclusivamente as informações do CNPJ na Receita Federal para identificar a
constituição jurídico-administrativa dos estabelecimentos de saúde (Port. Nº 1.319/SAS/MS/2014), em
[http://bvsms.saude.gov.br/bvs/saudelegis/sas/2014/prt1319_24_11_2014.html.](http://bvsms.saude.gov.br/bvs/saudelegis/sas/2014/prt1319_24_11_2014.html.) A Tabela de Natureza Jurídica organiza estes códigos segundo cinco
grandes categorias: Administração pública; Entidades empresariais; Entidades sem fins lucrativos; Pessoas físicas e organizações internacionais; e Outras

### instituições extraterritoriais.


Divisão de Análise e Administração de Dados – DIAAD

### 3.3. MUDANÇAS OCORRIDAS NOS ARQUIVOS DE APAC

### Não houve mudanças.

### 3.4. LAYOUT DOS ARQUIVOS DE APAC

### 3.4.1. LAYOUT DO ARQUIVO DE LAUDOS DIVERSOS: ADUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
3 AP_GESTAO CHAR (6) Cód. da Unidade de Federação + Cód. Município de Gestão, ou UF0000 se a Unidade está sob Gestão Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo, sssssss –
sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ da Mantenedora do estabelecimento ou zeros, caso não a tenha
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade do paciente
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da Unidade de Federação + Código Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Código da Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do endereço do paciente
23 AP_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento:
0 = mesma UF; 1 = UF diferente
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento:
0 = mesmo município; 1 = município diferente
25 AP_DTINIC CHAR (8) Data de INÍCIO validade (AAAAMMDD)
26 AP_DTFIM CHAR (8) Data de FIM validade (AAAAMMDD)
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 - única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código CNES do Estabelecimento Solicitante
40 AP_DTSOLIC CHAR(8) Data da Solicitação (AAAAMMDD)
41 AP_DTAUT CHAR(8) Data da Autorização (AAAAMMDD)
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
```
### 3.4.2. LAYOUT DO ARQUIVO DE APAC DE MEDICAMENTOS: AMUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão na qual Estado ou Município está habilitado
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

#### 3 AP_GESTAO CHAR (6)

```
Código da Unidade de Federação + Código do Município de Gestão, ou UF0000 se o estabelecimento está
sob Gestão Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo, sssssss
```
- sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (12.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ Mantenedora
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade do paciente
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código Unidade de Federação + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Código da Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente
23 AP_UFDIF CHAR (2) Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento
24 AP_MNDIF CHAR (2) Indica se o município de residência do paciente é diferente do município de localização do estabelecimento
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 – única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código do Estabelecimento solicitante no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 AM_PESO CHAR (3) Peso do paciente em kg
47 AM_ALTURA CHAR (3) Altura do paciente em cm
48 AM_TRANSPL CHAR (1) Indicador se o paciente fez transplante
49 AM_QTDTRAN CHAR (2) Quantidade de Transplantes
50 AM_GESTANT CHAR (1) Indicador de Gestante (S = Sim; N = Não)

### 3.4.3. LAYOUT DO ARQUIVO DE APAC DE NEFROLOGIA: ANUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob Gestão
Estadual
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo, sssssss
```
- sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código de Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente

```
23 AP_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N = não, S =
sim)
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento
(N = não, S = sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 - única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código do Estabelecimento solicitante no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 AN_DTPDR CHAR (8) Data (AAAAMMDD) da PRIMEIRA diálise realizada
47 AN_ALTURA CHAR (3) Altura do paciente em cm
48 AN_PESO CHAR (3) Peso do paciente em kg
49 AN_DIURES CHAR (4) Diurese em ml
50 AN_GLICOS CHAR (4) Glicose em Mg/dl
51 AN_ACEVAS CHAR (1) Acesso Vascular (S = Sim; N = Não)
52 AN_ULSOAB CHAR (1) Ultrassonografia Abdominal (S = Sim; N = Não)
53 AN_TRU CHAR (4) TRU (taxa de redução de ureia)
54 AN_INTFIS CHAR (2) Quantidade de intervenção de Fístula
55 AN_CNCDO CHAR (1) Inscrito na lista da CNCDO (S = Sim; N = Não)
56 AN_ALBUMI CHAR (2) Albumina em g%
57 AN_HCV CHAR (1) Indicativo de presença de Anticorpos de HCV (P = Positivo; N = Negativo)
58 AN_HBSAG CHAR (1) Indicativo de HBsAg (P = Positivo; N = Negativo)
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
59 AN_HIV CHAR (1) Indicativo de presença de anticorpos de HIV (P = Positivo; N = Negativo)
60 AN_HB CHAR (2) HB em g%
```
### 3.4.4. LAYOUT DO ARQUIVO DE APAC DE QUIMIOTERAPIA: AQUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob Gestão
Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo, sssssss
```
- sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (12.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente

```
23 AP_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N = não, S =
sim)
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento
(N = não, S = sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 - única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código do Estabelecimento solicitante no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 AQ_CID10 CHAR (4) CID 10 – Topografia
47 AQ_LINFIN CHAR (1) Linfonodos regionais invadidos (S = Sim; N = Não; 3 = Não Avaliáveis)
48 AQ_ESTADI CHAR (1) Estádio - UICC (0; 1; 2; 3; 4)
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
49 AQ_GRAHIS CHAR (2) Grau Histopatológico
50 AQ_DTIDEN CHAR (8) Data da identificação patológica do caso (AAAAMMDD)
51 AQ_TRANTE CHAR (1) Tratamentos anteriores (S = Sim; N = Não)
52 AQ_CIDINI1 CHAR (4) CID 1º Tratamento anterior
53 AQ_DTINI1 CHAR (8) Data de início (AAAAMMDD) 1º tratamento anterior
54 AQ_CIDINI2 CHAR (4) CID 2º Tratamento anterior
55 AQ_DTINI2 CHAR (8) Data de início (AAAAMMDD) 2º tratamento anterior
56 AQ_CIDINI3 CHAR (4) CID 3º Tratamento anterior
57 AQ_DTINI3 CHAR (8) Data de início (AAAAMMDD) 3º tratamento anterior
58 AQ_CONTTR CHAR (1) Continuidade do tratamento (S = Sim; N = Não)
59 AQ_DTINTR CHAR (8) Data de INÍCIO do tratamento solicitado (AAAAMMDD)
60 AQ_ESQU_P1 CHAR (5) ESQUEMA (Sigla ou abrev.) - 5 primeiras posições
61 AQ_TOTMPL CHAR (3) Total de MESES Planejados
62 AQ_TOTMAU CHAR (3) Total de MESES Autorizados
63 AQ_ESQU_P2 CHAR (10) ESQUEMA (Sigla ou abrev.) - 10 últimas posições
64 AP_NATJUR CHAR (4) Código da Natureza Jurídica
```
### 3.4.5. LAYOUT DO ARQUIVO DE APAC DE RADIOTERAPIA: ARUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob Gestão
Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde: UF – Unid. da Federação, AA – ano, T – tipo, sssssss –
sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente
23 AP_UFDIF CHAR (2) Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N = não, S = sim)
```
```
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento (N
= não, S = sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 - única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código CNES do Estabelecimento Solicitante
40 AP_DTSOLIC CHAR (8) Data da Solicitação
41 AP_DTAUT CHAR (8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 AR_SMRD CHAR (3)
47 AR_CID10 CHAR (4) CID- 10 - Topografia
48 AR_LINFIN CHAR (1) Linfonodos regionais invadidos (S = Sim; N =Não; 3= Não Avaliáveis)
49 AR_ESTADI CHAR (1) Estádio - UICC (0; 1; 2; 3; 4)
50 AR_GRAHIS CHAR (2) Grau Histopatológico
51 AR_DTIDEN CHAR (8) Data da identificação patológica do caso (AAAAMMDD)
52 AR_TRANTE CHAR (1) Tratamentos anteriores (S = Sim; N = Não)
53 AR_CIDINI1 CHAR (4) CID 1º Tratamento anterior
54 AR_DTINI1 CHAR (8) Data de INÍCIO (AAAAMMDD) 1º tratamento anterior
55 AR_CIDINI2 CHAR (4) CID 2º Tratamento anterior
56 AR_DTINI2 CHAR (8) Data de INÍCIO (AAAAMMDD) 2º tratamento anterior
57 AR_CIDINI3 CHAR (4) CID 3º Tratamento anterior
58 AR_DTINI3 CHAR (8) Data de início (AAAAMMDD) 3º tratamento anterior
59 AR_CONTTR CHAR (1) Continuidade do tratamento (S = Sim; N = Não)
60 AR_DTINTR CHAR (8) Data de INÍCIO do tratamento solicitado (AAAAMMDD)
```
```
61 AR_FINALI CHAR (1)
Finalidade do Tratamento: (1 = RADICAL; 2 = ADJUVANTE; 3 = ANTIÁLGICA; 4 = PALIATIVA; 5 = PRÉVIA; 6 =
ANTIHEMORRÁGICA)
62 AR_CIDTR1 CHAR (4) CID Topográfico 1º
63 AR_CIDTR2 CHAR (4) CID Topográfico 2º
64 AR_CIDTR3 CHAR (4) CID Topográfico 3º
65 AR_NUMC1 CHAR (3) Nº Campo/Inserções 1º
66 AR_INIAR1 CHAR (8) Data de INÍCIO 1º (AAAAMMDD)
67 AR_INIAR2 CHAR (8) Data de INÍCIO 2º (AAAAMMDD)
68 AR_INIAR3 CHAR (8) Data de INÍCIO 3º (AAAAMMDD)
69 AR_FIMAR1 CHAR (8) Data de Fim 1º (AAAAMMDD)
70 AR_FIMAR2 CHAR (8) Data de FIM 2º (AAAAMMDD)
71 AR_FIMAR3 CHAR (8) Data de Fim 3º (AAAAMMDD)
72 AR_NUMC2 CHAR (3) Nº Campo/Inserções 2º
73 AR_NUMC3 CHAR (3) Nº Campo/Inserções 3º
74 AP_NATJUR CHAR (4) Código da Natureza Jurídica
```
### 3.4.6. LAYOUT DO ARQUIVO DE APAC DE CIRURGIA BARIÁTRICA: ABUFMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão na qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob
Gestão Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde: UF – Unid. da Federação, AA – ano, T – tipo,
sssssss – sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
```
```
19 AP_RACACOR CHAR (2)
Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem
informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente
```
```
23 AP_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N=não,
S=sim)
```
```
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do
estabelecimento (N=não, S=sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 - inicial, 2 - continuidade, 3 - única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código CNES do Estabelecimento Solicitante
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 AB_IMC CHAR (3) IMC do paciente
47 AB_PROCAIH CHAR (10) Procedimento do AIH
48 AB_DTCIRUR CHAR (8) Data da Cirurgia
49 AB_NUMAIH CHAR (13) Número da AIH
50 AB_PRCAIH2 CHAR (10) Procedimento do AIH
51 AB_PRCAIH3 CHAR (10) Procedimento do AIH
52 AB_NUMAIH2 CHAR (13) Número da AIH
53 AB_DTCIRG2 CHAR (8) Data da Cirurgia
54 AB_MESACOM CHAR (2) Número em MESES de Acompanhamento
55 AB_ANOACOM CHAR (4) Ano de Acompanhamento
56 AB_PONTBAR CHAR (1) Pontuação de Baros^12
57 AB_TABBARR CHAR (1) Tabela de Baros
58 AP_NATJUR CHAR(4) Código da Natureza Jurídica
```
(^12) Bariatric Analysis and Reporting Outcome System (BAROS) é considerado o método mais eficaz e utilizado para a avaliação global do tratamento
operatório da obesidade mórbida; porém, possui inúmeras críticas e precisa ser atualizado - ANÁLISE CRÍTICA DO MÉTODO BAROS:
[http://www.scielo.br/scielo.php?pid=S0102-67202015000600073&script=sci_arttext&tlng=pt](http://www.scielo.br/scielo.php?pid=S0102-67202015000600073&script=sci_arttext&tlng=pt)


Divisão de Análise e Administração de Dados – DIAAD

### 3.4.7. LAYOUT DO ARQUIVO DE APAC DE CONFECÇÃO DE FÍSTULA ARTERIOVENOSA: ACFUFMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob Gestão
Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo,
sssssss – sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente
```
```
23 AP_UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N = não, S =
sim)
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento
(N = não, S = sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 – inicial, 2 – continuidade, 3 – única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código do Estabelecimento Solicitante no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
45 AP_ETNIA CHAR (4) Etnia do paciente
46 ACF_DUPLEX CHAR (1) Duplex prévio (S - Sim, N - Não)
47 ACF_USOCAT CHAR (1) Uso do cateter venoso ou outros acessos venosos prévios (S - Sim, N - Não)
48 ACF_PREFAV CHAR (1) FAV prévia (S - Sim, N - Não)
49 ACF_FLEBIT CHAR (1) Flebites (S - Sim, N - Não)
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
50 ACF_HEMATO CHAR (1) Hematomas (S - Sim, N - Não)
51 ACF_VEIAVI CHAR (1) Veia visível (S - Sim, N - Não)
52 ACF_PULSO CHAR (1) Presença de pulso (S - Sim, N - Não)
53 ACF_VEIDIA NUMERIC(4) Diâmetro da veia (em mm)
54 ACF_ARTDIA NUMERIC (4) Diâmetro da artéria (em mm)
55 ACF_FREMIT CHAR(1) Frêmito - Vibração perceptível pelo tato
56 AP_NATJUR CHAR(4) Código da Natureza Jurídica
```
### 3.4.8. LAYOUT DO ARQUIVO DE APAC DE TRATAMENTO DIALÍTICO: ATDUFMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 AP_MVM CHAR (6) Data de Processamento / Movimento (AAAAMM)
2 AP_CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
```
```
3 AP_GESTAO CHAR (6)
Código da Unidade de Federação + Código Município de Gestão ou UF0000 se a Unidade está sob Gestão
Estadual
4 AP_CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
5 AP_AUTORIZ CHAR (13)
Número da APAC. Lei de formação: UFAATsssssssd, onde UF – Unid. da Federação, AA – ano, T – tipo, sssssss –
sequencial, d – dígito
6 AP_CMP CHAR (6) Data de Atendimento ao paciente / Competência (AAAAMM)
7 AP_PRIPAL CHAR (10) Procedimento Principal da APAC
8 AP_VL_AP NUMERIC (20.2) Valor Total da APAC Aprovado
9 AP_UFMUN CHAR (6) Código da Unidade da Federação + Código do Município do Estabelecimento
10 AP_TPUPS CHAR (2) Tipo de Estabelecimento
11 AP_TIPPRE CHAR (2) Tipo de Prestador
12 AP_MN_IND CHAR (1) Estabelecimento Mantido / Individual
13 AP_CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
14 AP_CNPJMNT CHAR (14) CNPJ MANTENEDORA
15 AP_CNSPCN CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
16 AP_COIDADE CHAR (1) Código da Idade
17 AP_NUIDADE CHAR (2) Número da Idade
18 AP_SEXO CHAR (1) Sexo do paciente
19 AP_RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
20 AP_MUNPCN CHAR (6) Código da UF + Código do Município de Residência do paciente
21 AP_UFNACIO CHAR (3) Nacionalidade do paciente
22 AP_CEPPCN CHAR (8) CEP do paciente
23 AP_UFDIF CHAR (1) Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento (N - não, S - sim)
```
```
24 AP_MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento (N -
não, S - sim)
25 AP_DTINIC CHAR (8) Data de INÍCIO validade
26 AP_DTFIM CHAR (8) Data de FIM validade
27 AP_TPATEN CHAR (2) Tipo de Atendimento de APAC
28 AP_TPAPAC CHAR (1) Indica se a APAC é 1 – inicial, 2 – continuidade, 3 – única
29 AP_MOTSAI CHAR (2) Motivo de Saída e Permanência
30 AP_OBITO CHAR (1) Indicador de Óbito
31 AP_ENCERR CHAR (1) Indicador de Encerramento
32 AP_PERMAN CHAR (1) Indicador de Permanência
33 AP_ALTA CHAR (1) Indicador de Alta
34 AP_TRANSF CHAR (1) Indicador de Transferência
35 AP_DTOCOR CHAR (8) Data de Ocorrência que substitui a data de FIM de validade
36 AP_CODEMI CHAR (10) Código do Órgão emissor
37 AP_CATEND CHAR (2) Caráter do Atendimento
38 AP_APACANT CHAR (13) Número APAC Anterior
39 AP_UNISOL CHAR (7) Código CNES do Estabelecimento Solicitante
40 AP_DTSOLIC CHAR(8) Data da Solicitação
41 AP_DTAUT CHAR(8) Data da Autorização
42 AP_CIDCAS CHAR (4) CID Causas Associadas
43 AP_CIDPRI CHAR (4) CID Principal
44 AP_CIDSEC CHAR (4) CID Secundário
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
45 AP_ETNIA CHAR (4) Etnia do paciente
46 ATD_CARACT CHAR (1) Característica do tratamento
47 ATD_DTPDR CHAR (8) Data (AAAAMMDD) do início da primeira dialise
48 ATD_DTCLI CHAR (8) Data (AAAAMMDD) do início da dialise nesta clinica
49 ATD_ACEVAS CHAR (1) Acesso Vascular
50 ATD_MAISNE CHAR (1) Acompanhado há mais de um ano com nefrologia (S - Sim, N - Não, I - Ignorado)
51 ATD_SITINI CHAR (1) Situação Inicial
52 ATD_SITTRA CHAR ( 1 ) Situação de transplante (1 - Apto, 2 - Inapto, 3 - Recusa, 4 - N/A caso novo, com menos de 90 dias de tratamento)
```
```
53 ATD_SEAPTO CHAR ( 1 )
Se Apto a transplante (1 - Inscrito na CNCDO, 2 - Em processo de avaliação transplantante no centro
transplantador, 3 - Sem encaminhamento, 4 - Aguardando agendamento de consulta no centro transplantador)
54 ATD_HB CHAR (4) HB (hemoglobina)
55 ATD_FOSFOR CHAR (4) Fósforo
56 ATD_KTVSEM CHAR (4) Kt/v Semanal
57 ATD_TRU CHAR (4) TRU (taxa de redução de ureia)
58 ATD_ALBUMI CHAR (4) Albumina
59 ATD_PTH CHAR (4) PTH (hormônio da paratireoide)
60 ATD_HIV CHAR (1) Indicativo de presença de anticorpos de HIV (P - Positivo; N - Negativo)
61 ATD_HCV CHAR (1) Indicativo de presença de anticorpos de HCV (P - Positivo; N - Negativo)
62 ATD_HBSAG CHAR (1) Indicativo de HBsAg (P - Positivo; N - Negativo)
```
```
63 ATD_INTERC CHAR (1)
Usuário internado, com data de início no mês vigente, para tratamento de intercorrência clínica? (S – Sim, N -
Não, I - Ignorado)
64 ATD_SEPERI CHAR (1) Se em Diálise Peritoneal, houve peritonite diagnosticada no mês vigente? (S - Sim, N - Não, I - Ignorado)
65 AP_NATJUR CHAR (4) Código da Natureza Jurídica
```
## 4. REGISTRO DAS AÇÕES AMBULATORIAIS DE SAÚDE - RAAS

### 4.1. LAYOUT DO ARQUIVO DE ATENÇÃO DOMICILIAR: SAD*.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 CNES_EXEC CHAR (7) Código do SCNES do Estabelecimento de Saúde
2 GESTAO CHAR (6) Unidade da Federação + Código do Município do Gestor, ou UF0000 se a Unidade está sob Gestão Estadual
3 CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
4 UFMUN CHAR (6) Unidade da Federação + município onde está localizado o Estabelecimento
5 TPUPS CHAR (2) Tipo de do Estabelecimento
6 MN_IND CHAR (1) Estabelecimento Mantido / Individual
7 CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
8 CNPJMNT CHAR (14) CNPJ da Mantenedora do Estabelecimento ou zeros, caso não a tenha
9 DT_PROCESS CHAR (6) Mês de Processamento (AAAAMM)
10 DT_ATEND CHAR (6) Mês do Atendimento (AAAAMM)
11 CNS_PAC CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente (criptografia)
12 DTNASC CHAR (8) Data de nascimento do paciente
13 TPIDADEPAC CHAR (1) Tipo da Idade do paciente em anos, meses ou dias. Calculado a partir da data de nascimento
14 IDADEPAC CHAR (2) Idade do paciente
15 NACION_PAC CHAR(2) Nacionalidade do paciente
16 SEXOPAC CHAR (1) Sexo do paciente
17 RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
18 ETNIA CHAR (4) Etnia do paciente (Caso seja da Raça/Cor Indígena)
19 MUNPAC CHAR (6) Unidade da Federação + município do município de residência do paciente
20 MOT_COB CHAR (2) Motivo de Saída/Permanência
21 DT_MOTCOB CHAR (8) Data da ocorrência no caso de alta, transferência ou óbito
22 CATEND CHAR (2) Caráter de Atendimento
23 CIDPRI CHAR (4) CID Principal
24 CIDASSOC CHAR (4) CID Causas Associadas
25 ORIGEM_PAC CHAR (2) Origem do paciente
26 DT_INÍCIO CHAR (8) Data de Início
27 DT_FIM CHAR (8) Data de Fim
28 COB_ESF CHAR (1) Indica se a região de atendimento do paciente tem cobertura de Estratégia Saúde da Família
29 CNES_ESF CHAR (7) Código do SCNES do Estabelecimento de Saúde Unidade da Saúde da Família da região
30 DESTINO_PAC CHAR (2) Destino do paciente
31 PA_PROC_ID CHAR (10) Código de Procedimento Ambulatorial
32 PA_QTDPRO NUMERIC (11) Quantidade Produzida (APRESENTADA)
```

Divisão de Análise e Administração de Dados – DIAAD

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
33 PA_QTDAPR NUMERIC (11) Quantidade aprovada do procedimento
34 PA_SRV CHAR (4) Serviço Especializado
35 PA_CLAS_S CHAR (4) Classificação do Serviço
36 PA_EQUIPE CHAR (12) Código da Equipe (somente para o Instrumento de registro RAAS)
37 PA_TP_EQP CHAR(2) Tipo de Equipe (somente para o Instrumento de registro RAAS)
38 PA_CID CHAR (4) CID do Procedimento
39 DT_INICIO CHAR (8) Data de Início do Atendimento (DDMMAAAA)
40 DT_FIM CHAR (8) Data de Fim do Atendimento (DDMMAAAA)
41 PERMANENCIA CHAR (4) Permanência em Atendimento
42 QTDATE CHAR (4) Quantidade de Atendimentos
43 QTDPCN CHAR (4) Quantidade de pacientes
```
### 4.2. LAYOUT DO ARQUIVO DE RAAS – PSICOSSOCIAL: PS*.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 CNES_EXEC CHAR (7) Código do SCNES do Estabelecimento de Saúde
2 GESTAO CHAR (6) Unidade da Federação + Código do Município do Gestor, ou UF0000 se a Unidade está sob Gestão Estadual
3 CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
4 UFMUN CHAR (6) Unidade da Federação + município onde está localizado o Estabelecimento
5 TPUPS CHAR (2) Tipo de do Estabelecimento
6 TIPPRE CHAR (2) Tipo de Prestador
7 MN_IND CHAR (1) Estabelecimento Mantido / Individual
8 CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
9 CNPJMNT CHAR (14) CNPJ da Mantenedora do Estabelecimento ou zeros, caso não a tenha
10 DT_PROCESS CHAR (14) Data de Processamento (AAAAMM)
11 DT_ATEND CHAR (6) Data do Atendimento (AAAAMM)
12 CNS_PAC CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente (criptografia)
13 DTNASC CHAR (8) Data de nascimento do paciente
14 TPIDADEPAC CHAR (1) Tipo da Idade do paciente em anos, meses ou dias. Calculado a partir da data de nascimento
15 IDADEPAC CHAR (2) Idade do paciente
16 NACION_PAC CHAR (2) Nacionalidade do paciente
17 SEXOPAC CHAR (1) Sexo do paciente
18 RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
19 ETNIA CHAR (4) Etnia do paciente (Caso seja da Raça/Cor Indígena)
20 MUNPAC CHAR (6) Unidade da Federação + município do município de residência do paciente
21 MOT_COB CHAR (2) Motivo de Saída/Permanência
22 DT_MOTCOB CHAR (8) Data da ocorrência no caso de alta, transferência ou óbito
23 CATEND CHAR (2) Caráter de Atendimento
24 CIDPRI CHAR (4) CID Principal
25 CIDASSOC CHAR (4) CID Causas Associadas
26 ORIGEM_PAC CHAR (2) Origem do paciente
27 DT_INICIO CHAR (8) Data de Início
28 DT_FIM CHAR (8) Data de Fim
29 COB_ESF CHAR (1) Indica se a região de atendimento do paciente tem cobertura de Estratégia Saúde da Família
30 CNES_ESF CHAR (7) Código do SCNES do Estabelecimento de Saúde Unidade da Saúde da Família da região
31 DESTINOPAC CHAR (2) Destino do paciente
32 PA_PROC_ID CHAR(10) Ação Realizada
33 QT_APRES NUMERIC (11) Quantidade Apresentada
34 QT_APROV NUMERIC (11) Quantidade Aprovada
35 SERV CHAR (3) Código do Serviço Especializado
36 CLASS CHAR (3) Código da Classificação do Serviço
37 SIT_RUA CHAR (1) Situação de Rua (S- SIM, N - NÃO)
38 TP_DROGA CHAR (3) TIPO DE DROGA (A - Álcool, C - Crack, O - Outros)
39 LOC_REALIZ CHAR (1) Local de Realização (C – CAPS, T - Território)
40 INICIO CHAR (8) Data de Início do Atendimento (DDMMAAAA)
41 FIM CHAR (8) Data de Fim do Atendimento (DDMMAAAA)
42 PERMANEN CHAR (4) Permanência em Atendimento
43 QTDATE CHAR (4) Quantidade de Atendimentos
```

```
Divisão de Análise e Administração de Dados – DIAAD
```
#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
44 QTDPCN CHAR (4) Quantidade de pacientes
```
## 5. BOLETIM DE PRODUÇÃO AMBULATORIAL INDIVIDUALIZADO – BPA-I

### 5.1. INFORMAÇÕES GERAIS

### BIufaamm.dbf

### BI – Sigla de identificação do arquivo de Produção Ambulatorial Individualizado

### uf – sigla da Unidade da Federação

### aa – ano da competência

### mm – mês da competência

### Com o objetivo de ampliar o conhecimento sobre as ações e serviços realizados pelo SUS, a Portaria SAS/MS n° 709, de 27

### de dezembro de 2007 instituiu um novo instrumento de registro no SIA de forma individualizada. O BPA conservou sua

### forma original de registro agregado, para alguns procedimentos através do BPA Consolidado (BPA-C), sendo acrescido o

### BPA Individualizado (BPA-I), e este último passou a registrar informações sobre os usuários do SUS, assim como de sua

### situação de saúde através da CID.

### 5.2. LAYOUT DO ARQUIVO DE BPA-I: BIUFAAMM.DBF

#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
1 CODUNI CHAR (7) Código do Estabelecimento no CNES (Cadastro Nacional de Estabelecimentos de Saúde)
```
```
2 GESTAO CHAR (6)
Código da Unidade da Federação + Código do Município (IBGE) do Gestor, ou UF0000 se o estabelecimento
estiver sob Gestão Estadual
3 CONDIC CHAR (2) Sigla do Tipo de Gestão no qual o Estado ou Município está habilitado
4 UFMUN CHAR (6) Código da Unidade da Federação + Código do Município onde está localizado o estabelecimento
5 TPUPS CHAR (2) Tipo de do Estabelecimento
6 TIPPRE CHAR (2) Tipo de Prestador
7 MN_IND CHAR (1) Estabelecimento Mantido / Individual
8 CNPJCPF CHAR (14) CNPJ do Estabelecimento executante
9 CNPJMNT CHAR (14) CNPJ da Mantenedora do estabelecimento ou zeros, caso não a tenha
10 CNPJ_CC CHAR (14) CNPJ do Órgão que recebeu pela produção por cessão de crédito ou zeros, caso não o tenha
11 DT_PROCESS CHAR (6) Ano e mês de Processamento da produção (AAAAMM)
12 DT_ATEND CHAR (6) Ano e mês do Atendimento (AAAAMM)
13 PROC_ID CHAR (10) Código do Procedimento Ambulatorial
14 TPFIN CHAR (2) Tipo de Financiamento da produção
15 SUBFIN CHAR (4) Subtipo de Financiamento da produção
16 COMPLEX CHAR (1) Complexidade do Procedimento
```
#### 17 AUTORIZ CHAR (13)

```
Número da APAC ou número de autorização do BPA-I, conforme o caso. No BPA-I, não é obrigatório, portanto,
não é criticado. Lei de formação: UFAATsssssssd, onde: UF – Unid. da Federação, AA – ano, T – tipo, sssssss –
sequencial, d – dígito.
18 CNSPROF CHAR (15) Número do CNS (Cartão Nacional de Saúde) do profissional de saúde executante
19 CBOPROF CHAR (6) Código da Ocupação do profissional na Classificação Brasileira de Ocupações (Ministério do Trabalho)
20 CIDPRI CHAR (4) CID Principal
21 CATEND CHAR (2) Caráter de Atendimento
22 CNS_PAC CHAR (15) Número do CNS (Cartão Nacional de Saúde) do paciente
23 DTNASC CHAR (8) Data de nascimento do Paciente
24 TPIDADEPAC CHAR (1) Tipo da Idade do paciente em anos, meses ou dias. Calculado a partir da data de nascimento
25 IDADEPAC CHAR (2) Idade do Paciente
26 SEXOPAC CHAR (1) Sexo do paciente
27 RACACOR CHAR (2) Raça/Cor do paciente: 01 - Branca, 02 - Preta, 03 - Parda, 04 - Amarela, 05 - Indígena, 99 - Sem informação
```
```
28 MUNPAC CHAR (6)
Código da Unidade da Federação + Código do Município de residência do paciente ou do estabelecimento, caso
não se tenha a identificação do paciente, o que ocorre no (BPA)
29 QT_APRES NUMERIC (20.0) Quantidade Produzida (APRESENTADA)
30 QT_APROV NUMERIC (20. 0 ) Quantidade Aprovada do procedimento
```

```
Divisão de Análise e Administração de Dados – DIAAD
```
#### SEQ CAMPO TIPO E TAM DESCRIÇÃO

```
31 VL_APRES NUMERIC (20.2) Valor Produzido (APRESENTADO)
32 VL_APROV NUMERIC (20.2) Valor Aprovado do procedimento
```
```
33 UFDIF CHAR (1)
Indica se a UF de residência do paciente é diferente da UF de localização do estabelecimento:
0 = mesma UF; 1 = UF diferente
34 MNDIF CHAR (1)
Indica se o município de residência do paciente é diferente do município de localização do estabelecimento:
0 = mesmo município; 1 = município diferente
35 ETNIA CHAR (4)
Conteúdo definido conforme Portaria SAS Nº 508, de 28 de Setembro de 2010. Anexo I.
Preencher somente se o campo RACACOR for 05 - Indígena. A partir da competência Out/2010.
37 NAT_JUR CHAR (4) Código da Natureza Jurídica
```

Divisão de Análise e Administração de Dados – DIAAD

## 6. FORMAS DE CONTATO COM O DATASUS

### Por correspondência ou ofício:

### Ministério da Saúde

### Secretaria Executiva

### Departamento de Informática do SUS / DATASUS

### Esplanada dos Ministérios, Bloco "G", Anexo, 1° Andar, Sala 107

### CEP: 70.058- 900 - Brasília/DF

### Por telefone:

### Coordenação-Geral de Governança e Gestão de Projetos em TIC – CGGOV

### Coordenação de Disseminação de Dados em Saúde – CODDS

### Divisão de Análise e Administração de Dados – DIAAD

### ( 2 1) 3 315 - 7206 ou (21) 3985 - 7209

### Por e-mail:

### dissemina.sus@saude.gov.br