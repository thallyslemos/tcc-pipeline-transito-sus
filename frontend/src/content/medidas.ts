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
} as const satisfies Record<string, string>;

export type MedidaId = keyof typeof medidas;
