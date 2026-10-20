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
  aoClicarLink?: () => void;
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
          <button type="button" onClick={aoClicarLink} className="text-[11px] underline" style={{ color: "var(--brand)" }}>
            Link do recorte
          </button>
        )}
        {aoClicarExportar && (
          <button
            type="button"
            onClick={aoClicarExportar}
            className="text-[11px] underline"
            style={{ color: "var(--brand)" }}
          >
            Exportar
          </button>
        )}
      </div>
    </div>
  );
}
