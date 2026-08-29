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
  | { motivo: "frota_ausente" };

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
  }
}
