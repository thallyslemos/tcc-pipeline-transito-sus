import { formatPercentual, formatTaxa100k } from "../format";
import type { LeituraGerada, PontoSerieAnual } from "./types";

/** R1 · precondicao: serie.length >= 3 (design/DESIGN_SYSTEM.md §6.2). */
export const R1_MIN_PONTOS = 3;

export function podeAplicarR1(serie: PontoSerieAnual[]): boolean {
  return serie.length >= R1_MIN_PONTOS;
}

/**
 * "A taxa passou de {v0} em {a0} para {v1} em {a1} — {alta|queda} de {pct}.
 * Minimo da janela: {vmin} em {amin}."
 *
 * v0/a0 = primeiro ponto da serie; v1/a1 = ultimo. Empate (v1 === v0) conta
 * como "queda" de 0,0% — o template so admite as duas palavras, sem uma
 * terceira forma para estabilidade.
 */
export function gerarR1(serie: PontoSerieAnual[]): LeituraGerada | null {
  if (!podeAplicarR1(serie)) return null;

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const minimo = serie.reduce((atual, ponto) => (ponto.valor < atual.valor ? ponto : atual), serie[0]);

  const pct = primeiro.valor === 0 ? 0 : (Math.abs(ultimo.valor - primeiro.valor) / primeiro.valor) * 100;
  const direcao = ultimo.valor > primeiro.valor ? "alta" : "queda";

  const texto =
    `A taxa passou de ${formatTaxa100k(primeiro.valor)} em ${primeiro.periodo} para ` +
    `${formatTaxa100k(ultimo.valor)} em ${ultimo.periodo} — ${direcao} de ${formatPercentual(pct)}%. ` +
    `Mínimo da janela: ${formatTaxa100k(minimo.valor)} em ${minimo.periodo}.`;

  return { gerado: true, regra: "R1", texto };
}
