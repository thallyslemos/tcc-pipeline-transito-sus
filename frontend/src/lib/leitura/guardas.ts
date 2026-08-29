import { formatNumber, formatPercentual } from "../format";
import type { InputG1, InputG2, LeituraSuprimida } from "./types";

/** G1 · n insuficiente (design/DESIGN_SYSTEM.md §6.2). */
export const G1_LIMITE_TOTAL = 20;

export function disparaG1(input: InputG1): boolean {
  return input.totalObitos < G1_LIMITE_TOTAL;
}

/** "Com {n} óbitos no recorte, a taxa oscila mais de 10 pontos com um caso a mais. A leitura foi suprimida." */
export function gerarG1(input: InputG1): LeituraSuprimida | null {
  if (!disparaG1(input)) return null;
  return {
    gerado: false,
    regra: "G1",
    texto: `Com ${formatNumber(input.totalObitos)} óbitos no recorte, a taxa oscila mais de 10 pontos com um caso a mais. A leitura foi suprimida.`,
  };
}

/** G2 · evento único: maior dia > 50% do total (design/DESIGN_SYSTEM.md §6.2). */
export const G2_LIMITE_SHARE_DIA_PICO = 0.5;

export function disparaG2(input: InputG2): boolean {
  return input.shareDiaPico > G2_LIMITE_SHARE_DIA_PICO;
}

/**
 * "{pct}% dos óbitos do recorte ocorreram num único dia ({data}). O recorte
 * descreve um evento, não risco habitual."
 *
 * Este é o "caso Gavião" (design/DESIGN_SYSTEM.md §6.2): em 2024, os 20
 * óbitos do município ocorreram todos em janeiro, um único acidente na
 * BR-324 — reportar a taxa anual sem esta guarda produz um número
 * tecnicamente correto e epidemiologicamente enganoso. Quando a fonte de
 * dado não tem a data exata do dia de pico (nem toda API expõe essa
 * granularidade), o parêntese com a data é omitido — a frase continua
 * válida sem ela.
 */
export function gerarG2(input: InputG2): LeituraSuprimida | null {
  if (!disparaG2(input)) return null;
  const pct = formatPercentual(input.shareDiaPico * 100);
  const parenteseData = input.dataPico ? ` (${input.dataPico})` : "";
  return {
    gerado: false,
    regra: "G2",
    texto: `${pct}% dos óbitos do recorte ocorreram num único dia${parenteseData}. O recorte descreve um evento, não risco habitual.`,
  };
}
