"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { formatNumber } from "@/lib/format";

export interface ChipRecorte {
  rotulo: string;
  valor: string;
}

interface Props {
  chips: ChipRecorte[];
  /** N do recorte atual — sempre visivel, nunca escondido atras de um clique. */
  n: number;
  /** Copia/mostra a URL que reproduz exatamente este recorte (design/DESIGN_SYSTEM.md §5.6). Omitido = botao nao aparece. */
  aoClicarLink?: () => Promise<void>;
  /** Omitido = botao nao aparece (Fase 9 ainda nao ligada em toda tela). */
  aoClicarExportar?: () => void;
}

/**
 * design/DESIGN_SYSTEM.md §5.6 — cabecalho fixo com chips do recorte ativo,
 * "N = …" e os botoes de link do recorte / exportar. Renderiza ACIMA de
 * <FilterBar> (nao a substitui): FilterBar e o controle de entrada, esta
 * barra e o resumo de saida — papeis diferentes, mesmo estado.
 */
export default function BarraDeRecorte({ chips, n, aoClicarLink, aoClicarExportar }: Props) {
  const [copia, setCopia] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const copying = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  async function copiar() {
    if (!aoClicarLink || copying.current) return;
    copying.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
    setCopia("copying");
    try {
      await aoClicarLink();
      if (mounted.current) {
        setCopia("copied");
        timer.current = setTimeout(() => setCopia("idle"), 2000);
      }
    } catch {
      if (mounted.current) setCopia("error");
    } finally {
      copying.current = false;
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
      style={{ backgroundColor: "var(--sunken)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.rotulo}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink-2)" }}
          >
            <span style={{ color: "var(--ink-3)" }}>{chip.rotulo}</span>
            <span className="num">{chip.valor}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="num text-[11px]" style={{ color: "var(--ink-2)" }}>
          N = {formatNumber(n)}
        </span>
        {aoClicarLink && (
          <button type="button" onClick={copiar} disabled={copia === "copying"} className="inline-flex items-center gap-1 text-[11px] underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 disabled:opacity-60" style={{ color: "var(--brand)" }}>
            {copia === "copied" && <Check aria-hidden="true" className="h-3 w-3" />}
            {copia === "copied" ? "Copiado!" : copia === "copying" ? "Copiando..." : "Link do recorte"}
          </button>
        )}
        {aoClicarLink && (
          <span role="status" aria-live="polite" aria-atomic="true" className={copia === "error" ? "text-[11px]" : "sr-only"}>
            {copia === "copied" ? "Link do recorte copiado." : copia === "error" ? "Não foi possível copiar o link. Tente novamente." : copia === "copying" ? "Copiando link do recorte." : ""}
          </span>
        )}
        {aoClicarExportar && (
          <button
            type="button"
            onClick={aoClicarExportar}
            className="text-[11px] underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
            style={{ color: "var(--brand)" }}
          >
            Exportar
          </button>
        )}
      </div>
    </div>
  );
}
