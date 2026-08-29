import { gerarR2 } from "./concentracao";
import { gerarR3 } from "./divergencia";
import { gerarG1, gerarG2 } from "./guardas";
import { gerarR1 } from "./tendencia";
import type { EntradaLeitura, Leitura } from "./types";

export * from "./types";
export { podeAplicarR2, R2_MIN_MUNICIPIOS, R2_TOP_K } from "./concentracao";
export { podeAplicarR3, R3_MIN_COM_TAXA } from "./divergencia";
export { disparaG1, disparaG2, G1_LIMITE_TOTAL, G2_LIMITE_SHARE_DIA_PICO } from "./guardas";
export { podeAplicarR1, R1_MIN_PONTOS } from "./tendencia";

/**
 * Orquestra o motor de leitura (design/DESIGN_SYSTEM.md §6.2): guardas
 * SEMPRE têm precedência sobre regras — se G1 ou G2 disparar, nenhuma
 * regra produz frase, mesmo que o campo correspondente tenha sido
 * informado em `entrada`. Cada campo de `entrada` é opcional porque nem
 * toda tela tem dado suficiente pra todo check; só é tentado o que foi
 * fornecido. Retorna `null` quando nada dispara (nem guarda, nem regra) —
 * a tela decide como comunicar "sem leitura disponível" nesse caso.
 */
export function gerarLeitura(entrada: EntradaLeitura): Leitura | null {
  if (entrada.g1) {
    const g1 = gerarG1(entrada.g1);
    if (g1) return g1;
  }
  if (entrada.g2) {
    const g2 = gerarG2(entrada.g2);
    if (g2) return g2;
  }
  if (entrada.r1) {
    const r1 = gerarR1(entrada.r1.pontos, entrada.r1.opcoes);
    if (r1) return r1;
  }
  if (entrada.r2) {
    const r2 = gerarR2(entrada.r2);
    if (r2) return r2;
  }
  if (entrada.r3) {
    const r3 = gerarR3(entrada.r3);
    if (r3) return r3;
  }
  return null;
}
