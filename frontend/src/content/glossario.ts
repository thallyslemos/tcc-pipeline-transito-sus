/**
 * Dicionario central da ajuda contextual (InfoTip). Fonte unica de verdade:
 * revisar texto aqui, nunca duplicar copia dentro das telas.
 *
 * Cada bloco (oQueE / comoSeLe / cuidado) deve ter no maximo 45 palavras
 * (tests/glossario.test.ts falha se algum passar disso). Linguagem direta,
 * sem jargao, sempre pt-BR. Numeros citados aqui vem do artigo do TCC — se
 * parecerem desatualizados, perguntar antes de alterar, nunca corrigir por
 * conta propria.
 */

export interface GlossarioEntry {
  /** Titulo curto mostrado no topo do popover. */
  titulo: string;
  oQueE: string;
  comoSeLe: string;
  cuidado: string;
}

export const glossario = {
  taxa_100mil: {
    titulo: "Taxa por 100 mil habitantes",
    oQueE: "Óbitos do município dividido pela população, multiplicado por 100 mil.",
    comoSeLe:
      "Permite comparar municípios de portes diferentes. A média da Bahia em 2024 foi 20,9 e a do Brasil 17,5.",
    cuidado:
      "Em municípios pequenos, poucos óbitos produzem taxas altíssimas e instáveis. Gavião chegou a 445,1 com 20 óbitos e 4.493 habitantes.",
  },
  taxa_10mil_veiculos: {
    titulo: "Taxa por 10 mil veículos",
    oQueE: "Óbitos divididos pela frota registrada na SENATRAN, por 10 mil veículos.",
    comoSeLe: "Aproxima a exposição ao risco — quantas mortes por veículo em circulação.",
    cuidado:
      "A frota registrada não é a frota circulante. Onde há muita moto sem registro, a taxa aparece maior do que é.",
  },
  dimensao_ocorrencia_residencia: {
    titulo: "Dimensão ocorrência / residência",
    oQueE: "Ocorrência é onde a pessoa morreu; residência é onde ela morava.",
    comoSeLe:
      "Ocorrência mede o risco do território (interessa a trânsito e engenharia viária); residência mede a carga sobre a população (interessa à saúde).",
    cuidado:
      "Os dois números são diferentes e ambos corretos. Bahia 2024: 3.105 por ocorrência e 3.041 por residência.",
  },
  concentracao_temporal: {
    titulo: "Concentração temporal / classe de evento",
    oQueE: "Proporção dos óbitos do ano que ocorreram no mês e no dia de maior número.",
    comoSeLe:
      "Acima de 50% no dia de pico, a taxa anual descreve um evento isolado, não o risco habitual do município.",
    cuidado:
      "Municípios marcados como \"evento único\" não devem ser comparados diretamente com os demais no ranking.",
  },
  distribuicao_dia_semana: {
    titulo: "Distribuição por dia da semana",
    oQueE:
      "Média de óbitos por dia, usando como denominador o número real de vezes que aquele dia ocorreu no calendário do período.",
    comoSeLe:
      "Valores acima da média geral indicam dias de maior letalidade. No Nordeste o fim de semana tem 1,79 vez a média dos dias úteis.",
    cuidado:
      "O SIM registra a data do ÓBITO, não a do sinistro. Vítimas que morrem dias depois deslocam a contagem para a frente.",
  },
  mapa_coropletico: {
    titulo: "Mapa coroplético",
    oQueE: "Cada município é colorido pela intensidade do indicador escolhido.",
    comoSeLe: "Tons mais escuros indicam valores maiores. Cinza significa ausência de registro, não ausência de risco.",
    cuidado:
      "Com escala linear, um único município extremo comprime todos os demais em uma faixa indistinguível. Prefira a escala por quantis para comparar o conjunto.",
  },
  fluxos_residencia_ocorrencia: {
    titulo: "Fluxos residência–ocorrência",
    oQueE: "Liga o município onde o óbito ocorreu aos municípios onde as vítimas moravam.",
    comoSeLe: "Setas grossas indicam mais vítimas vindas daquela origem.",
    cuidado:
      "Proporção alta de vítimas de fora indica que a taxa local reflete tráfego de passagem, e não o risco da população residente.",
  },
  filtro_tipo_veiculo: {
    titulo: "Filtro de tipo de veículo",
    oQueE: "Seleciona o modal da vítima, conforme a categoria da CID-10.",
    comoSeLe:
      "Permite comparar perfis. Em 2024 motociclistas somaram 933 óbitos contra 819 de ocupantes de automóvel.",
    cuidado:
      "\"Outros\" e \"não especificado\" concentram parcela relevante dos registros e não devem ser lidos como categoria residual desprezível.",
  },
  populacao_frota: {
    titulo: "População e frota (denominadores)",
    oQueE: "Bases usadas para calcular as taxas — IBGE para população, SENATRAN para frota.",
    comoSeLe:
      "Sem denominador do mesmo município e ano, a taxa não é calculada e aparece como N/D.",
    cuidado: "Quando o dado vier de ano diferente, o valor é aproximado e vem marcado.",
  },
} as const satisfies Record<string, GlossarioEntry>;

export type TermoGlossario = keyof typeof glossario;
