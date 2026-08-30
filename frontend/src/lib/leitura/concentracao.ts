import { formatNumber, formatPercentual } from "../format";
import type { LeituraGerada, MunicipioContagem } from "./types";

/** R2 · precondicao: municipios.length >= 5 (design/DESIGN_SYSTEM.md §6.2). */
export const R2_MIN_MUNICIPIOS = 5;

/**
 * k = 5 (nao especificado numericamente no documento-fonte; adotado o mesmo
 * valor da precondicao, deterministico e sempre aplicavel quando a regra
 * dispara — documentado aqui para nao virar "numero magico" sem origem).
 */
export const R2_TOP_K = 5;

export function podeAplicarR2(municipios: MunicipioContagem[]): boolean {
  return municipios.length >= R2_MIN_MUNICIPIOS;
}

/**
 * "Os {k} municípios de maior contagem somam {pct} dos óbitos do recorte,
 * liderados por {mun} com {n}."
 */
export function gerarR2(municipios: MunicipioContagem[]): LeituraGerada | null {
  if (!podeAplicarR2(municipios)) return null;

  const ordenado = [...municipios].sort((a, b) => b.obitos - a.obitos);
  const k = Math.min(R2_TOP_K, ordenado.length);
  const topK = ordenado.slice(0, k);
  const totalGeral = municipios.reduce((soma, m) => soma + m.obitos, 0);
  const totalTopK = topK.reduce((soma, m) => soma + m.obitos, 0);
  const pct = totalGeral === 0 ? 0 : (totalTopK / totalGeral) * 100;
  const lider = topK[0];

  const texto =
    `Os ${k} municípios de maior contagem somam ${formatPercentual(pct)}% dos óbitos do recorte, ` +
    `liderados por ${lider.municipio} com ${formatNumber(lider.obitos)}.`;

  return { gerado: true, regra: "R2", texto };
}
