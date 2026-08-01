"use client";

import { useTheme } from "@/components/ThemeProvider";
import { formatNumber, formatTaxa100k } from "@/lib/format";
import { mapChoroplethGradientCss } from "@/lib/mapGradient";

export type MapScaleMode = "total" | "relative";

interface Props {
  escala: MapScaleMode;
  minV: number;
  maxV: number;
  relativeCount: number;
}

export default function MapLegend({ escala, minV, maxV, relativeCount }: Props) {
  const { theme } = useTheme();
  const empty = relativeCount === 0;
  const format = (value: number) => escala === "total" ? formatNumber(Math.round(value)) : formatTaxa100k(value);
  return <div className="flex min-w-[200px] flex-col gap-1.5 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-secondary)" }}>{escala === "total" ? "Escala de Obitos" : "Obitos / 100 mil hab."}</span>{empty ? <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>Sem denominador populacional no filtro atual.</span> : <><span className="text-[9px]" style={{ color: "var(--fg-muted)" }}>Faixa conforme os municipios exibidos.</span><div className="h-3 w-full rounded-full" style={{ background: mapChoroplethGradientCss(theme === "dark") }} /><div className="flex justify-between text-[10px] tabular-nums" style={{ color: "var(--fg-muted)" }}><span>{format(minV)}</span><span>{format(maxV)}</span></div></>}</div>;
}
