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
  evolucao_anual_obitos:
    "Considera apenas óbitos com causa básica V01-V89, qa_status aprovado e tipo não fetal. Sem correção por crescimento populacional entre anos — variação reflete volume absoluto, não taxa.",
  obitos_por_tipo_veiculo:
    "Categorias fora de motociclista, pedestre, automóvel e ciclista são agrupadas em \"outros\" — a paleta categórica não se estende além dessas cinco.",
  obitos_por_faixa_etaria:
    "Faixas etárias de 10 anos. Idade ignorada ou inválida é classificada como \"Ignorada\", nunca descartada da contagem total.",
  distribuicao_por_sexo:
    "Sexo ignorado permanece como categoria própria — nunca reclassificado como feminino ou masculino.",
  ranking_municipios_obitos:
    "Ordenado por contagem bruta, não por taxa. Um município grande pode liderar aqui e não liderar por taxa por 100 mil (ver tela de Ranking).",
  padrao_mensal_consolidado_x_preliminar:
    "As duas séries nunca são somadas nem entram na mesma agregação — o trecho preliminar aparece em linha tracejada e é sempre lido junto do indicador de completude, nunca sozinho.",
  completude_por_mes:
    "completude = óbitos preliminares do mês / média de óbitos consolidados do mesmo mês nos até 3 anos anteriores. Nunca multiplique a contagem preliminar por 1/completude para estimar um total.",
} as const satisfies Record<MedidaId, string>;
