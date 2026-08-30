/**
 * Camada 1 — "Título de medida" (design/DESIGN_SYSTEM.md §6.1): o que esta
 * sendo medido e com qual denominador. Escrito UMA VEZ, revisado em code
 * review; nunca muda com filtro, nunca contem numero, nunca afirma achado.
 * Consumido por <GraficoMoldura medidaId="..." />.
 */

export const medidas = {
  serie_mensal_obitos:
    "Total de óbitos por competência mensal do óbito, contagem absoluta — sem denominador populacional.",
  distribuicao_dia_semana:
    "Média de óbitos por dia da semana, ajustada pelo número real de ocorrências de cada dia no período filtrado.",
  evolucao_anual_obitos: "Total de óbitos por ano, contagem absoluta — sem denominador populacional.",
  obitos_por_tipo_veiculo:
    "Óbitos por tipo de vítima (modal envolvido), conforme categoria da CID-10, contagem absoluta no recorte filtrado.",
  obitos_por_faixa_etaria: "Óbitos por faixa etária, contagem absoluta no recorte filtrado.",
  distribuicao_por_sexo: "Óbitos por sexo, contagem absoluta no recorte filtrado.",
  ranking_municipios_obitos:
    "Os 10 municípios com maior número absoluto de óbitos no recorte filtrado — sem denominador populacional.",
  padrao_mensal_consolidado_x_preliminar:
    "Comparação mês a mês entre o padrão consolidado (2024) e o padrão preliminar do ano corrente, para o mesmo mês-do-ano.",
  completude_por_mes:
    "Completude estimada da captação preliminar por mês — sinal de maturidade da base, não fator de correção do numerador.",
} as const satisfies Record<string, string>;

export type MedidaId = keyof typeof medidas;
