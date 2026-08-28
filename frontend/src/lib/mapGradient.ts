/**
 * Cores do mapa coroplético: baixo = azul, alto = vermelho.
 * t ∈ [0,1] normalizado pelo min/máx do conjunto exibido (filtro atual).
 */

export function mapChoroplethRgb(t: number, isDark: boolean): string {
  const x = Math.max(0, Math.min(1, t));
  if (isDark) {
    const r0 = 59,
      g0 = 130,
      b0 = 246;
    const r1 = 248,
      g1 = 113,
      b1 = 113;
    const r = Math.round(r0 + (r1 - r0) * x);
    const g = Math.round(g0 + (g1 - g0) * x);
    const b = Math.round(b0 + (b1 - b0) * x);
    return `rgb(${r},${g},${b})`;
  }
  const r0 = 30,
    g0 = 64,
    b0 = 175;
  const r1 = 185,
    g1 = 28,
    b1 = 28;
  const r = Math.round(r0 + (r1 - r0) * x);
  const g = Math.round(g0 + (g1 - g0) * x);
  const b = Math.round(b0 + (b1 - b0) * x);
  return `rgb(${r},${g},${b})`;
}

/** Gradiente CSS para legenda (mesmos extremos). */
export function mapChoroplethGradientCss(isDark: boolean): string {
  return isDark
    ? "linear-gradient(90deg, rgb(59,130,246) 0%, rgb(248,113,113) 100%)"
    : "linear-gradient(90deg, rgb(30,64,175) 0%, rgb(185,28,28) 100%)";
}

export const MAP_NEUTRAL_COLOR = "hsl(220, 12%, 55%)";
