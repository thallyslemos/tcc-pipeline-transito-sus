/**
 * Camada 2 — "Nota de método" (design/DESIGN_SYSTEM.md §6.1): denominador,
 * criterio de inclusao, limite de interpretacao. Escrito UMA VEZ, revisado
 * em code review; nunca muda com filtro, nunca contem numero. As chaves
 * espelham exatamente as de content/medidas.ts (mesmo medidaId).
 */

import type { MedidaId } from "./medidas";

export const metodo = {
  serie_mensal_obitos:
    "Considera apenas óbitos com causa básica V01-V89, qa_status aprovado e tipo não fetal. O mês de pico é destacado na cor de risco; os demais meses ficam em cor neutra.",
  distribuicao_dia_semana:
    "Denominador de cada dia da semana: quantas vezes aquele dia ocorreu no calendário do recorte filtrado, não 1/7 do total. Compara fim de semana e dia útil por teste qui-quadrado de aderência.",
} as const satisfies Record<MedidaId, string>;
