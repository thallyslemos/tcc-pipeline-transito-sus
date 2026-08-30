/**
 * design/DESIGN_SYSTEM.md §9 — unico modulo que conhece cor/fonte/tick de
 * grafico. Nenhuma pagina passa cor, fonte ou tamanho de tick diretamente;
 * cada serie pede um preset nomeado por FUNCAO SEMANTICA (taxa/absoluto/
 * referencia/preliminar), nunca por indice da serie.
 *
 * Nota sobre a regra de ouro ("dado preenche, interface traca"): `serie.taxa`
 * usa --risk-5 como STROKE (traco), nao preenchimento — isso nao e excecao a
 * regra. Numa marca de LINHA nao ha area a preencher; o traco e a unica
 * superficie que carrega a codificacao de valor, entao ali o traco cumpre o
 * papel de "preenchimento" da marca. A regra continua valendo a risca para
 * chrome de interface (borda de botao, foco, aba ativa) — esses nunca usam
 * a rampa de risco nem a paleta categorica.
 */

export const grid = {
  horizontal: true,
  vertical: false,
  stroke: "var(--chart-grid)",
};

/** Trilho de hover Recharts — token --chart-cursor, distinto do preenchimento da barra. */
export const cursor = { fill: "var(--chart-cursor)" };

export const axisX = {
  tickLine: false,
  dy: 6,
  axisLine: { stroke: "var(--hairline)" },
  tick: { fontSize: 11, fill: "var(--ink-3)", fontFamily: "var(--font-mono)" },
};

export const axisY = {
  ...axisX,
  axisLine: false,
  width: 56,
};

export const serie = {
  taxa: { stroke: "var(--risk-5)", strokeWidth: 2.5, dot: false },
  absoluto: { fill: "var(--risk-2)", stroke: "none" },
  referencia: { stroke: "var(--chart-ref)", strokeWidth: 1.5, strokeDasharray: "4 4" },
  preliminar: { stroke: "var(--attention)", strokeWidth: 2, strokeDasharray: "5 4" },
} as const;

/** Rampa de risco (dado sequencial) e cortes fixos — ver src/lib/theme/mapaClasses.ts (Fase 6) para o uso no mapa coropletico. */
export const RISK5 = ["var(--risk-1)", "var(--risk-2)", "var(--risk-3)", "var(--risk-4)", "var(--risk-5)"];
export const BREAKS = [12, 18, 26, 39];

export function porClasse(valor: number): string {
  return RISK5[BREAKS.filter((corte) => valor >= corte).length];
}
