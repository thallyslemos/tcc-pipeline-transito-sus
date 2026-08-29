/**
 * Cores do mapa coroplético para as escalas SEM classe fixa validada
 * ("total" e "vehicle_rate" — ver src/lib/theme/mapaClasses.ts). t ∈ [0,1]
 * normalizado pelo min/máx do conjunto exibido (filtro atual): a limitação
 * de ser relativo ao recorte continua (design/DECISOES.md — nao inventar
 * quintis nao validados), mas a PALETA passa a ser a mesma rampa de risco
 * sequencial de 1 matiz do resto do sistema (auditoria B2/B3: antes usava
 * azul->vermelho do Tailwind, cor nenhuma do design system).
 */

const RAMPA_LIGHT: [number, number, number][] = [
  [251, 235, 217], // --risk-1
  [246, 208, 174], // --risk-2
  [233, 168, 127], // --risk-3
  [206, 117, 81], // --risk-4
  [158, 62, 36], // --risk-5
];
const RAMPA_DARK: [number, number, number][] = [
  [58, 42, 32], // --risk-1 (escuro)
  [90, 58, 38], // --risk-2 (escuro)
  [135, 78, 46], // --risk-3 (escuro)
  [183, 106, 66], // --risk-4 (escuro)
  [224, 140, 94], // --risk-5 (escuro)
];

export function mapChoroplethRgb(t: number, isDark: boolean): string {
  const x = Math.max(0, Math.min(1, t));
  const rampa = isDark ? RAMPA_DARK : RAMPA_LIGHT;
  const posicao = x * (rampa.length - 1);
  const indice = Math.min(rampa.length - 2, Math.floor(posicao));
  const fracao = posicao - indice;
  const [r0, g0, b0] = rampa[indice];
  const [r1, g1, b1] = rampa[indice + 1];
  const r = Math.round(r0 + (r1 - r0) * fracao);
  const g = Math.round(g0 + (g1 - g0) * fracao);
  const b = Math.round(b0 + (b1 - b0) * fracao);
  return `rgb(${r},${g},${b})`;
}

/** Gradiente CSS para legenda (mesma rampa de risco, 5 paradas). */
export function mapChoroplethGradientCss(isDark: boolean): string {
  const rampa = isDark ? RAMPA_DARK : RAMPA_LIGHT;
  const paradas = rampa.map(([r, g, b], i) => `rgb(${r},${g},${b}) ${(i / (rampa.length - 1)) * 100}%`);
  return `linear-gradient(90deg, ${paradas.join(", ")})`;
}

export const MAP_NEUTRAL_COLOR = "hsl(220, 12%, 55%)";

/**
 * design/DESIGN_SYSTEM.md §8 — classes fixas (nao relativas ao recorte),
 * so pra taxa por 100 mil ("relative"). Ver src/lib/theme/mapaClasses.ts.
 * Mantida ao lado de mapChoroplethRgb (nao a substitui): "total" e
 * "vehicle_rate" continuam usando a escala relativa antiga.
 */
export { corClasseFixa as mapChoroplethClasse, rampaClasses as mapChoroplethRampaClasses } from "./theme/mapaClasses";
