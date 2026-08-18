# Evidências exploratórias da Bahia: SIM, população, fluxos e frota

Data da execução: 18 de agosto de 2026. Este relatório registra uma rodada adicional de consultas DuckDB feita depois da integração auditada da SENATRAN. Ele complementa o diário metodológico e não substitui a análise espacial e temporal definitiva do artigo.

## Decisão semântica sobre residência e ocorrência

Cada linha do SIM representa uma Declaração de Óbito e possui dois papéis geográficos independentes. `CODMUNRES` identifica o município de residência do falecido, enquanto `CODMUNOCOR` identifica o município onde ocorreu o óbito. O segundo campo não deve ser descrito como ponto do acidente: a vítima pode ter sido removida e morrer em outro município. O dicionário oficial do Ministério da Saúde define os dois campos no leiaute da tabela DO e os marca como obrigatórios; na base publicada, ainda podem existir valores nulos, inválidos ou sem correspondência municipal após a transmissão.

O arquivo utilizado neste projeto pertence ao diretório oficial `SIM/CID10/DORES`. Portanto, `DOBA2024.dbc` não deve ser interpretado como um conjunto de declarações emitidas ou de mortes ocorridas na Bahia. A partição é mantida como linhagem e, no snapshot analisado, coincide empiricamente com a UF de residência. Ela não substitui nenhum dos dois papéis epidemiológicos. Para contar residentes baianos, filtra-se `uf_residencia = 'BA'`. Para contar óbitos ocorridos na Bahia, é necessário reunir as partições nacionais e filtrar `uf_ocorrencia = 'BA'`.

No universo científico de 565.383 registros, não houve divergência entre `uf_arquivo` e `uf_residencia`, enquanto 29.379 registros divergiram entre `uf_arquivo` e `uf_ocorrencia`. Na partição `uf_arquivo = 'BA'`, havia 37.775 registros, 37.242 com residência na Bahia e 2.300 com ocorrência em outra UF. No universo nacional, 37.906 óbitos ocorreram na Bahia e 37.242 correspondiam a residentes baianos. As 2.432 ocorrências na Bahia com residência fora do estado e os 2.292 residentes baianos cujo óbito ocorreu fora da Bahia demonstram por que os totais não podem ser somados nem atribuídos automaticamente ao arquivo de origem.

## Reprodução

A execução foi realizada no WSL Ubuntu com DuckDB 1.4.4. O protocolo SQL está em `analysis/tcc2/eda_bahia_frota_fluxos_v2.sql`, o executor em `analysis/tcc2/run_eda_sim_bahia.py` e a validação da API em `analysis/tcc2/validate_tool_effectiveness.py`. O filtro científico permaneceu `is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'`. A execução gerou dez consultas nomeadas e o manifesto em `outputs/tcc2/eda_bahia_frota_fluxos_v2/manifesto_execucao.json`.

| Entrada | SHA-256 usado na execução |
|---|---|
| Silver nacional `sim_v2_nacional_2010_2024_contract_v2.parquet` | `5869f067227d2c8ea759bbc953aa942c6c7f60fc3f8c448e663c20aa3741c74c` |
| Gold de frota municipal anual | `9839b0b9bb350f30a0b1f9962e9ba1b6224b011575e5f22804f5db8cf0b5fa08` |
| Gold de frota por tipo | `de9cb0bf5a2f7e46e95499281bb5f97a1001c5890bc0f1f83fe5c65982cb5e05` |
| População municipal de staging | `0244fdc4cda050023234cdeed5db489723c38d4ea9f1c6c00e76db1bb61aa702` |
| Dimensão municipal IBGE | `2bc909833ebfcdfa2a85403bb207854ecd47cebeb72d3d18b37338ab457c2aa7` |

Os artefatos originais não foram alterados. As consultas de frota usam o estoque municipal da SENATRAN na competência de dezembro e a dimensão populacional do staging oficial do SIDRA. A ausência de população em 2023 permanece nula; ela não foi preenchida com 2022 ou 2024.

## Resultados anuais

| Ano | Óbitos de residentes BA | Óbitos ocorridos BA | Motociclistas residentes | Frota de duas rodas | Taxa de motociclistas por 10 mil duas rodas |
|---:|---:|---:|---:|---:|---:|
| 2010 | 2.547 | 2.612 | 517 | 790.224 | 6,54 |
| 2015 | 2.237 | 2.257 | 685 | 1.328.727 | 5,16 |
| 2022 | 2.422 | 2.473 | 705 | 1.795.713 | 3,93 |
| 2023 | 2.723 | 2.838 | 937 | 1.905.143 | 4,92 |
| 2024 | 3.012 | 3.105 | 953 | 2.031.641 | 4,69 |

Entre 2010 e 2024, a frota de duas rodas aumentou 157,1%, enquanto os óbitos de motociclistas residentes aumentaram 84,3%. A taxa exploratória caiu de 6,54 para 4,69 por 10 mil veículos de duas rodas. No painel municipal-ano, a correlação de níveis entre mortes de motociclistas residentes e frota de duas rodas foi 0,748 em 6.255 observações; nas primeiras diferenças consecutivas foi 0,040 em 5.838 observações. Esses valores descrevem associação e tendência compartilhada, não efeito causal. A frota não mede quilômetros percorridos, uso efetivo, circulação de não residentes ou exposição individual.

## Fluxos municipais

Os municípios com maior saldo entre óbitos ocorridos e óbitos de residentes no período foram Salvador, com 4.216 ocorrências e 3.179 residentes, Vitória da Conquista, com 2.029 e 1.213, Santo Antônio de Jesus, com 815 e 265, Feira de Santana, com 1.602 e 1.066, e Barreiras, com 832 e 344. Considerando apenas municípios com pelo menos 30 óbitos em cada papel, as entradas externas corresponderam a 39,42% das ocorrências de Salvador, 51,95% das de Vitória da Conquista, 75,71% das de Santo Antônio de Jesus, 49,81% das de Feira de Santana e 65,14% das de Barreiras.

Em Vitória da Conquista, o resultado confirma a hipótese de centralidade regional como descrição do fluxo registrado: 1.054 das 2.029 mortes ocorridas no município tinham residência externa, enquanto 238 dos 1.213 residentes morreram fora. O SIM não informa a rota, o motivo do deslocamento nem se o óbito ocorreu depois de transferência hospitalar. Por isso, o artigo deve chamar o resultado de fluxo residência–ocorrência, e não de origem do acidente ou trajetória da vítima.

## Anomalias e verificação externa

O detector exploratório baseado em desvio da série anual destacou Gavião em 2024: 20 óbitos por ocorrência, população de 4.493 habitantes e taxa bruta de 445,14 por 100 mil. Os registros concentram-se em 7 de janeiro, e 16 das vítimas tinham residência em Jacobina, três em Juazeiro e uma em Jaguarari. A nota oficial do Departamento de Polícia Técnica da Bahia, publicada em 9 de janeiro de 2024, descreve uma colisão entre caminhão e micro-ônibus na BR-324, nas proximidades de Gavião, com 23 mortes. A fonte externa confirma a existência do evento, mas os universos não são idênticos; a diferença entre 20 registros do SIM e 23 mortes da nota deve ser mantida como questão de reconciliação, não como erro presumido.

Barreiras permanece como quebra de cobertura ou de fenômeno a investigar. A ocorrência passa de zero em 2015 para 92 em 2016 e se mantém elevada até 2024; a residência passa de três para 30 no mesmo intervalo. A busca realizada não encontrou publicação municipal específica que explique a ruptura. Antes de qualquer interpretação, a série deve ser reproduzida no TABNET e confrontada com causas externas, arquivos de origem, datas, municípios de residência e alterações de cobertura.

## Validação da ferramenta

O script de validação chamou `GET /api/sim/summary` e `GET /api/sim/geo` no recorte de ocorrência, Bahia, 2024 e categoria `Motociclista`. A API retornou 933 óbitos e 417 polígonos; a consulta independente na Silver retornou os mesmos 933 registros. As duas comparações foram verdadeiras: `summary_vs_silver = true` e `geo_vs_silver = true`. Essa verificação demonstra paridade de serving, não validade epidemiológica.

Na branch de implementação, a suíte Python foi executada com a Gold auditada apontada explicitamente pelo ambiente e retornou 116 testes aprovados e 9 ignorados. Os testes de análise do TCC retornaram 4 aprovados. A validação de interface deve permanecer como evidência complementar de uso, enquanto a reconciliação Silver–Gold e API–DuckDB são as provas centrais de correção numérica.

## Decisão para o artigo

A SENATRAN entra no TCC II como dimensão complementar e exploratória, mantendo SIM e IBGE como núcleo da pergunta científica. A taxa por veículos pode aparecer para descrever a relação entre mortalidade de motociclistas e estoque de duas rodas, desde que o tipo de veículo do numerador e o denominador sejam explicitados. Não será apresentada como risco individual, efeito da frota ou explicação causal.

Os resultados de fluxos e o caso de Gavião são candidatos a tabelas e figuras da versão final. A análise espacial confirmatória, a estimação formal de tendência, a sensibilidade a pequenas populações, a validação bibliográfica e a reconciliação de 2023 continuam pendentes. Nenhum ranking anual bruto deve ser promovido a conclusão sem essas etapas.

## Fontes oficiais consultadas

Ministério da Saúde. [Dicionário de dados da tabela DO do SIM, edição de julho de 2025](https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/documentacao/dicionario-de-dados-SIM-tabela-DO.pdf). Ministério da Saúde. [Nota metodológica do TABNET sobre contagens por residência e ocorrência](https://tabnet.datasus.gov.br/cgi/sim/Obitos_Evitaveis_0_a_4_anos.pdf). Bahia. Departamento de Polícia Técnica. [Nota sobre o acidente entre caminhão e micro-ônibus em Gavião](https://www.ba.gov.br/policiatecnica/noticia/2024-04/940/nota-policia-tecnica-acidente-entre-caminhao-e-micro-onibus-em-gaviao), publicada em 9 de janeiro de 2024.
