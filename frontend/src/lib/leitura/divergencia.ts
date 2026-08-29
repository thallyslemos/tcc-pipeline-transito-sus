import { formatNumber } from "../format";
import type { LeituraGerada, MunicipioTaxa } from "./types";

/**
 * R3 · precondicao: "tem populacao pareada" (design/DESIGN_SYSTEM.md §6.2) —
 * interpretado como pelo menos 2 municipios com taxa nao-nula, o minimo pra
 * comparar uma ordenacao por contagem contra uma ordenacao por taxa.
 */
export const R3_MIN_COM_TAXA = 2;

function comTaxa(municipios: MunicipioTaxa[]): (MunicipioTaxa & { taxa: number })[] {
  return municipios.filter((m): m is MunicipioTaxa & { taxa: number } => m.taxa != null);
}

export function podeAplicarR3(municipios: MunicipioTaxa[]): boolean {
  return comTaxa(municipios).length >= R3_MIN_COM_TAXA;
}

/**
 * "Ordenado por contagem, {mun} lidera; por taxa cai para a {p}ª posição.
 * No topo por taxa: {mun2}, {r}× a taxa do líder absoluto."
 *
 * O lider absoluto (maior contagem) precisa ter taxa conhecida pra calcular
 * sua posicao no ranking por taxa e a razao — se nao tiver, a regra nao
 * dispara mesmo com a precondicao geral satisfeita (nao ha o que comparar).
 */
export function gerarR3(municipios: MunicipioTaxa[]): LeituraGerada | null {
  if (!podeAplicarR3(municipios)) return null;

  const porContagem = [...municipios].sort((a, b) => b.obitos - a.obitos);
  const liderAbsoluto = porContagem[0];
  if (liderAbsoluto.taxa == null) return null;

  const porTaxa = comTaxa(municipios).sort((a, b) => b.taxa - a.taxa);
  const posicaoLiderPorTaxa = porTaxa.findIndex((m) => m.municipio === liderAbsoluto.municipio) + 1;
  const liderPorTaxa = porTaxa[0];
  const razao = liderAbsoluto.taxa === 0 ? 0 : liderPorTaxa.taxa / liderAbsoluto.taxa;

  const texto =
    `Ordenado por contagem, ${liderAbsoluto.municipio} lidera; por taxa cai para a ${posicaoLiderPorTaxa}ª posição. ` +
    `No topo por taxa: ${liderPorTaxa.municipio}, ${formatNumber(Math.round(razao * 10) / 10)}× a taxa do líder absoluto.`;

  return { gerado: true, regra: "R3", texto };
}
