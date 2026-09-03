/**
 * Dicionario central da ajuda contextual (InfoTip). Fonte unica de verdade:
 * revisar texto aqui, nunca duplicar copia dentro das telas.
 *
 * Unifica o que antes eram dois sistemas paralelos: o glossario de cartoes
 * (feat/ajuda-contextual: oQueE/comoSeLe/cuidado) e o popover "[?]" de
 * grafico do design system v2.1 (design/DESIGN_SYSTEM.md §6.3: "o que este
 * grafico mostra"/"como ler"/"o que ele nao permite concluir") — sao a mesma
 * estrutura de 3 blocos com nomes de campo diferentes; os 9 termos ja
 * escritos e revisados foram mantidos, so os campos foram renomeados pro
 * vocabulario do design system. Consumido tanto por <KpiStat> (icone ⓘ)
 * quanto por <GraficoMoldura> (botao [?]) via InfoTip.tsx.
 *
 * Cada bloco (oQueMostra / comoLer / oQueNaoPermiteConcluir) deve ter no
 * maximo 45 palavras (tests/ajuda.test.ts falha se algum passar disso).
 * Linguagem direta, sem jargao, sempre pt-BR. Numeros citados aqui vem do
 * artigo do TCC — se parecerem desatualizados, perguntar antes de alterar,
 * nunca corrigir por conta propria.
 */

export interface AjudaEntry {
  /** Titulo curto mostrado no topo do popover. */
  titulo: string;
  oQueMostra: string;
  comoLer: string;
  oQueNaoPermiteConcluir: string;
}

export const ajuda = {
  taxa_100mil: {
    titulo: "Taxa por 100 mil habitantes",
    oQueMostra: "Óbitos do município dividido pela população, multiplicado por 100 mil.",
    comoLer:
      "Permite comparar municípios de portes diferentes. A média da Bahia em 2024 foi 20,9 e a do Brasil 17,5.",
    oQueNaoPermiteConcluir:
      "Em municípios pequenos, poucos óbitos produzem taxas altíssimas e instáveis. Gavião chegou a 445,1 com 20 óbitos e 4.493 habitantes.",
  },
  taxa_10mil_veiculos: {
    titulo: "Taxa por 10 mil veículos",
    oQueMostra: "Óbitos divididos pela frota registrada na SENATRAN, por 10 mil veículos.",
    comoLer: "Aproxima a exposição ao risco — quantas mortes por veículo em circulação.",
    oQueNaoPermiteConcluir:
      "A frota registrada não é a frota circulante. Onde há muita moto sem registro, a taxa aparece maior do que é.",
  },
  dimensao_ocorrencia_residencia: {
    titulo: "Dimensão ocorrência / residência",
    oQueMostra: "Ocorrência é onde a pessoa morreu; residência é onde ela morava.",
    comoLer:
      "Ocorrência mede o risco do território (interessa a trânsito e engenharia viária); residência mede a carga sobre a população (interessa à saúde).",
    oQueNaoPermiteConcluir:
      "Os dois números são diferentes e ambos corretos. Bahia 2024: 3.105 por ocorrência e 3.041 por residência.",
  },
  concentracao_temporal: {
    titulo: "Concentração temporal / classe de evento",
    oQueMostra: "Proporção dos óbitos do ano que ocorreram no mês e no dia de maior número.",
    comoLer:
      "Acima de 50% no dia de pico, a taxa anual descreve um evento isolado, não o risco habitual do município.",
    oQueNaoPermiteConcluir:
      "Municípios marcados como \"evento único\" não devem ser comparados diretamente com os demais no ranking.",
  },
  distribuicao_dia_semana: {
    titulo: "Distribuição por dia da semana",
    oQueMostra:
      "Média de óbitos por dia, usando como denominador o número real de vezes que aquele dia ocorreu no calendário do período.",
    comoLer:
      "Valores acima da média geral indicam dias de maior letalidade. No Nordeste o fim de semana tem 1,79 vez a média dos dias úteis.",
    oQueNaoPermiteConcluir:
      "O SIM registra a data do ÓBITO, não a do sinistro. Vítimas que morrem dias depois deslocam a contagem para a frente.",
  },
  mapa_coropletico: {
    titulo: "Mapa coroplético",
    oQueMostra: "Cada município é colorido pela intensidade do indicador escolhido.",
    comoLer: "Tons mais escuros indicam valores maiores. Cinza significa ausência de registro, não ausência de risco.",
    oQueNaoPermiteConcluir:
      "Com escala linear, um único município extremo comprime todos os demais em uma faixa indistinguível. Prefira a escala por quantis para comparar o conjunto.",
  },
  fluxos_residencia_ocorrencia: {
    titulo: "Fluxos residência–ocorrência",
    oQueMostra: "Liga o município onde o óbito ocorreu aos municípios onde as vítimas moravam.",
    comoLer: "Setas grossas indicam mais vítimas vindas daquela origem.",
    oQueNaoPermiteConcluir:
      "Proporção alta de vítimas de fora indica que a taxa local reflete tráfego de passagem, e não o risco da população residente.",
  },
  filtro_tipo_veiculo: {
    titulo: "Filtro de tipo de veículo",
    oQueMostra: "Seleciona o modal da vítima, conforme a categoria da CID-10.",
    comoLer:
      "Permite comparar perfis. Em 2024 motociclistas somaram 933 óbitos contra 819 de ocupantes de automóvel.",
    oQueNaoPermiteConcluir:
      "\"Outros\" e \"não especificado\" concentram parcela relevante dos registros e não devem ser lidos como categoria residual desprezível.",
  },
  populacao_frota: {
    titulo: "População e frota (denominadores)",
    oQueMostra: "Bases usadas para calcular as taxas — IBGE para população, SENATRAN para frota.",
    comoLer:
      "Sem denominador do mesmo município e ano, a taxa não é calculada e aparece como N/D.",
    oQueNaoPermiteConcluir: "Quando o dado vier de ano diferente, o valor é aproximado e vem marcado.",
  },
  // Auditoria M6: painel nao tinha nenhum botao [?] — so /temporal tinha.
  serie_mensal_obitos: {
    titulo: "Série mensal de óbitos",
    oQueMostra: "Total de óbitos por mês de óbito (competência), contagem absoluta.",
    comoLer: "O mês de maior contagem é destacado na cor de risco; os demais ficam em cor neutra.",
    oQueNaoPermiteConcluir:
      "Contagem absoluta não corrige por população nem por número de dias do mês — não compare municípios de tamanho diferente por aqui.",
  },
  evolucao_anual_obitos: {
    titulo: "Evolução anual de óbitos",
    oQueMostra: "Total de óbitos por ano, contagem absoluta.",
    comoLer: "Subida ou queda entre anos reflete volume, não necessariamente risco — população também muda.",
    oQueNaoPermiteConcluir:
      "Sem correção por crescimento populacional: um aumento de óbitos pode coincidir com um aumento igual de habitantes, sem mudança real de risco.",
  },
  obitos_por_tipo_veiculo: {
    titulo: "Óbitos por tipo de vítima",
    oQueMostra: "Contagem de óbitos por modal envolvido (motociclista, pedestre, automóvel, ciclista, outros), conforme categoria da CID-10.",
    comoLer: "Compara o peso relativo de cada modal no recorte filtrado.",
    oQueNaoPermiteConcluir:
      "\"Outros\"/\"não especificado\" concentram parcela relevante — não é uma categoria residual desprezível.",
  },
  obitos_por_faixa_etaria: {
    titulo: "Óbitos por faixa etária",
    oQueMostra: "Contagem de óbitos por faixa etária de 10 anos.",
    comoLer: "Faixas com mais óbitos absolutos não são necessariamente as de maior risco por habitante.",
    oQueNaoPermiteConcluir:
      "Sem denominador populacional por faixa etária, não dá pra calcular taxa — só comparar volume dentro do recorte.",
  },
  distribuicao_por_sexo: {
    titulo: "Óbitos por sexo",
    oQueMostra: "Contagem de óbitos por sexo registrado no SIM.",
    comoLer: "Sexo ignorado é mantido como categoria própria, nunca reclassificado.",
    oQueNaoPermiteConcluir: "Contagem absoluta, não taxa — não corrige por população de cada sexo no recorte.",
  },
  ranking_municipios_obitos: {
    titulo: "Ranking por número absoluto de óbitos",
    oQueMostra: "Os 10 municípios com maior contagem bruta de óbitos no recorte filtrado.",
    comoLer: "Ordenado por contagem, não por taxa.",
    oQueNaoPermiteConcluir:
      "Um município grande pode liderar aqui e não liderar por taxa por 100 mil — ver a tela de Ranking pra comparação por taxa.",
  },
  media_diaria_mensal: {
    titulo: "Média diária no mês",
    oQueMostra: "Óbitos do mês divididos pelos dias civis daquele mês (28 a 31).",
    comoLer: "Compara meses com durações diferentes — fevereiro deixa de parecer artificialmente mais baixo só por ter menos dias.",
    oQueNaoPermiteConcluir: "Não é taxa por habitante; ainda é contagem absoluta normalizada pelo calendário.",
  },
} as const satisfies Record<string, AjudaEntry>;

export type TermoAjuda = keyof typeof ajuda;
