"use client";

import { useTheme } from "@/components/ThemeProvider";
import { formatNumber, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { mapChoroplethGradientCss } from "@/lib/mapGradient";

export type MapScaleMode = "total" | "relative" | "vehicle_rate";

interface Props {
  escala: MapScaleMode;
  minV: number;
  maxV: number;
  relativeCount: number;
}

export default function MapLegend({ escala, minV, maxV, relativeCount }: Props) {
  const { theme } = useTheme();
  const empty = relativeCount === 0;
  const format = (value: number) => {
    if (escala === "total") return formatNumber(Math.round(value));
    if (escala === "vehicle_rate") return formatTaxa10k(value);
    return formatTaxa100k(value);
  };
  const title = escala === "total"
    ? "Escala de obitos"
    : escala === "vehicle_rate"
      ? "Obitos / 10 mil veiculos"
      : "Obitos / 100 mil hab.";
  const emptyMessage = escala === "vehicle_rate"
    ? "Sem denominador SENATRAN no recorte atual."
    : "Sem denominador populacional no filtro atual.";
  return <div className="flex min-w-[200px] flex-col gap-1.5 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-secondary)" }}>{title}</span>
    {empty ? <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{emptyMessage}</span> : <><span className="text-[9px]" style={{ color: "var(--fg-muted)" }}>Faixa conforme os municipios exibidos.</span><div className="h-3 w-full rounded-full" style={{ background: mapChoroplethGradientCss(theme === "dark") }} /><div className="flex justify-between text-[10px] tabular-nums" style={{ color: "var(--fg-muted)" }}><span>{format(minV)}</span><span>{format(maxV)}</span></div></>}
  </div>;
}
