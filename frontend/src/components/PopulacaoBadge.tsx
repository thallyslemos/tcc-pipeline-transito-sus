"use client";

import { AlertCircle } from "lucide-react";
import type { PopulacaoOrigem } from "@/lib/types";

interface Props {
  origem: PopulacaoOrigem | undefined;
  anoReferencia?: number | null;
  defasagemAnos?: number | null;
  className?: string;
}

/**
 * Marcacao visual discreta para taxas derivadas de populacao ESTIMADA (ano
 * IBGE mais proximo, nao o mesmo ano do obito). Nao renderiza nada quando a
 * populacao e exata ou indisponivel — a marcacao existe so para o caso que
 * poderia parecer exato sem ser.
 */
export default function PopulacaoBadge({ origem, anoReferencia, defasagemAnos, className }: Props) {
  if (origem !== "estimada") return null;

  const anoLabel = anoReferencia ?? "?";
  const defasagemLabel =
    defasagemAnos == null
      ? ""
      : ` (defasagem de ${defasagemAnos} ${defasagemAnos === 1 ? "ano" : "anos"})`;

  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      title={`Populacao estimada: ano ${anoLabel}${defasagemLabel}. IBGE nao publicou populacao deste municipio para o ano do obito.`}
      aria-label={`Populacao estimada a partir de ${anoLabel}${defasagemLabel}`}
    >
      <AlertCircle className="h-3 w-3" style={{ color: "var(--warning)" }} strokeWidth={2.2} />
    </span>
  );
}
