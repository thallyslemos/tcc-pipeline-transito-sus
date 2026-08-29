/**
 * design/DESIGN_SYSTEM.md §8 — correcao estrutural do mapa: classes FIXAS
 * em vez de escala relativa ao min/max do recorte filtrado (o que faz o
 * mesmo municipio mudar de cor entre duas consultas e torna a legenda
 * incomparavel). Cortes sao quintis de taxa por 100 mil, 2010-2024,
 * congelados em codigo (design/tokens.css --break-1..4 = 12/18/26/39).
 *
 * So a taxa por 100 mil ("relative") tem classes fixas definidas no design
 * system — contagem absoluta ("total") e taxa veicular ("vehicle_rate") nao
 * tem quintis validados, entao continuam com escala relativa ao recorte
 * (ver MapView.tsx). Documentado como limitacao explicita, nao descuido.
 *
 * Valores hex literais (nao var(--risk-*)): MapLibre GL nao resolve
 * variaveis CSS em expressoes de pintura — precisa da cor computada de
 * verdade nas properties do GeoJSON. Mesmos valores de design/tokens.css.
 * Este arquivo e um dos dois lugares (com src/lib/theme/chart.ts) onde
 * hexadecimal e permitido fora de tokens.css.
 */

export const BREAKS = [12, 18, 26, 39];

const RISK5_LIGHT = ["#FBEBD9", "#F6D0AE", "#E9A87F", "#CE7551", "#9E3E24"];
const RISK5_DARK = ["#3A2A20", "#5A3A26", "#874E2E", "#B76A42", "#E08C5E"];

/** Indice da classe (0-4) pro valor informado, conforme os cortes fixos. */
export function classeDe(valor: number): number {
  return BREAKS.filter((corte) => valor >= corte).length;
}

/** Cor literal (hex) da classe fixa — uso em paint/GeoJSON do MapLibre. */
export function corClasseFixa(valor: number, isDark: boolean): string {
  const rampa = isDark ? RISK5_DARK : RISK5_LIGHT;
  return rampa[classeDe(valor)];
}

/** Rampa completa, na ordem das classes — uso em <ClassLegend>. */
export function rampaClasses(isDark: boolean): string[] {
  return isDark ? RISK5_DARK : RISK5_LIGHT;
}
