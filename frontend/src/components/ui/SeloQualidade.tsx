import { AlertCircle } from "lucide-react";
import { textoQualidade, type EntradaQualidade } from "@/content/qualidade";

interface Props {
  entrada: EntradaQualidade;
  className?: string;
}

/**
 * design/DESIGN_SYSTEM.md §7 — marcador discreto de incerteza, reutilizado
 * em toda a aplicação: ponto/ícone em --attention + tooltip explicando o
 * motivo. Nunca vermelho — vermelho já significa mortalidade alta na
 * rampa de risco.
 */
export default function SeloQualidade({ entrada, className }: Props) {
  const texto = textoQualidade(entrada);
  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      title={texto}
      aria-label={texto}
    >
      <AlertCircle className="h-3 w-3" style={{ color: "var(--attention)" }} strokeWidth={2.2} />
    </span>
  );
}
