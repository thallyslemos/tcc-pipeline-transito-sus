"use client";

import SeloQualidade from "@/components/ui/SeloQualidade";
import type { PopulacaoOrigem } from "@/lib/types";

interface Props {
  origem: PopulacaoOrigem | undefined;
  anoReferencia?: number | null;
  defasagemAnos?: number | null;
  className?: string;
}

/**
 * Wrapper fino sobre <SeloQualidade> (design/DESIGN_SYSTEM.md §7) —
 * preserva a API antiga (origem/anoReferencia/defasagemAnos) pros 2
 * call-sites existentes (municipio, ranking) sem exigir edita-los.
 * Nao renderiza nada quando a populacao e exata ou indisponivel — o selo
 * existe so para o caso que poderia parecer exato sem ser.
 */
export default function PopulacaoBadge({ origem, anoReferencia, defasagemAnos, className }: Props) {
  if (origem !== "estimada") return null;

  return (
    <SeloQualidade
      entrada={{ motivo: "populacao_estimada", anoReferencia: anoReferencia ?? "?", defasagemAnos }}
      className={className}
    />
  );
}
