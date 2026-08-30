import { formatPercentual, formatTaxa100k } from "../format";
import type { LeituraGerada, OpcoesR1, PontoSerieAnual } from "./types";

/** R1 · precondicao: serie.length >= 3 (design/DESIGN_SYSTEM.md §6.2). */
export const R1_MIN_PONTOS = 3;

export type { OpcoesR1 };

export function podeAplicarR1(serie: PontoSerieAnual[]): boolean {
  return serie.length >= R1_MIN_PONTOS;
}

/**
 * "{sujeito} passou de {v0} em {a0} para {v1} em {a1} — {alta|queda} de
 * {pct}. Mínimo da janela: {vmin} em {amin}."
 *
 * v0/a0 = primeiro ponto da serie; v1/a1 = ultimo. Empate (v1 === v0) conta
 * como "queda" de 0,0% — o template so admite as duas palavras, sem uma
 * terceira forma para estabilidade.
 */
export function gerarR1(serie: PontoSerieAnual[], opcoes: OpcoesR1 = {}): LeituraGerada | null {
  if (!podeAplicarR1(serie)) return null;

  const sujeito = opcoes.sujeito ?? "A taxa";
  const formatarValor = opcoes.formatarValor ?? formatTaxa100k;

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const minimo = serie.reduce((atual, ponto) => (ponto.valor < atual.valor ? ponto : atual), serie[0]);

  const pct = primeiro.valor === 0 ? 0 : (Math.abs(ultimo.valor - primeiro.valor) / primeiro.valor) * 100;
  const direcao = ultimo.valor > primeiro.valor ? "alta" : "queda";

  const texto =
    `${sujeito} passou de ${formatarValor(primeiro.valor)} em ${primeiro.periodo} para ` +
    `${formatarValor(ultimo.valor)} em ${ultimo.periodo} — ${direcao} de ${formatPercentual(pct)}%. ` +
    `Mínimo da janela: ${formatarValor(minimo.valor)} em ${minimo.periodo}.`;

  return { gerado: true, regra: "R1", texto };
}
