/**
 * design/DESIGN_SYSTEM.md §7 — texto único para os 3 motivos de incerteza
 * que a interface precisa marcar (população estimada, dado preliminar,
 * frota ausente). Função PURA (sem JSX): usada tanto por
 * components/ui/SeloQualidade.tsx (React) quanto pelo popup HTML cru do
 * MapLibre em MapView.tsx (que não pode reusar componente React).
 */

export type EntradaQualidade =
  | { motivo: "populacao_estimada"; anoReferencia: number | string; defasagemAnos?: number | null }
  | { motivo: "preliminar"; dataExtracao?: string | null }
  | { motivo: "frota_ausente" }
  | { motivo: "taxa_instavel"; obitos: number };

// Auditoria A4/S3: G1 (lib/leitura/guardas.ts) so olha o N do RECORTE
// inteiro, nunca o de um municipio individual numa tabela — um municipio
// com 20 obitos e taxa de 445/100mil (caso real: Gaviao, BA, 2024) passa
// batido sem nenhum aviso. Nao e uma guarda nova do motor de leitura (essas
// falam de series, nao de linhas de tabela); e o mesmo selo de incerteza ja
// usado pra populacao estimada/preliminar/frota, com um motivo a mais.
// Limiar e CV emprestados da estatistica de contagem de Poisson: CV(taxa) =
// 1/sqrt(obitos). Documentado, nao um p-valor formal.
export const LIMIAR_TAXA_INSTAVEL_OBITOS = 20;
export const LIMIAR_TAXA_INSTAVEL_POPULACAO = 25_000;

/** true quando obitos < 20 OU populacao < 25 mil (qualquer um dos dois). */
export function taxaInstavel(obitos: number, populacao: number | null | undefined): boolean {
  return obitos < LIMIAR_TAXA_INSTAVEL_OBITOS || (populacao != null && populacao < LIMIAR_TAXA_INSTAVEL_POPULACAO);
}

export function coeficienteVariacao(obitos: number): number {
  return obitos > 0 ? 1 / Math.sqrt(obitos) : Infinity;
}

export function textoQualidade(entrada: EntradaQualidade): string {
  switch (entrada.motivo) {
    case "populacao_estimada": {
      const defasagemLabel =
        entrada.defasagemAnos == null
          ? ""
          : ` (defasagem de ${entrada.defasagemAnos} ${entrada.defasagemAnos === 1 ? "ano" : "anos"})`;
      return `População estimada: ano ${entrada.anoReferencia}${defasagemLabel}. IBGE não publicou população deste município para o ano do óbito.`;
    }
    case "preliminar":
      return `Dado preliminar${entrada.dataExtracao ? `, extraído em ${entrada.dataExtracao}` : ""}, sujeito a revisão e ainda em captação.`;
    case "frota_ausente":
      return "Frota SENATRAN não pareada para este município e ano — taxa veicular indisponível.";
    case "taxa_instavel": {
      const cv = (coeficienteVariacao(entrada.obitos) * 100).toFixed(0);
      return `Taxa instável: baseada em apenas ${entrada.obitos} óbito${entrada.obitos === 1 ? "" : "s"} (coeficiente de variação ≈ ${cv}%). Compare com cautela — pequenas variações de contagem mudam muito a taxa.`;
    }
  }
}
