"use client";

import { useTheme } from "@/components/ThemeProvider";
import { formatCurrency, formatNumber, formatTaxa100k } from "@/lib/format";
import { mapChoroplethGradientCss } from "@/lib/mapGradient";

export type MapScaleMode = "total" | "relative";

interface Props {
  metrica: string;
  /** "total" = cores pelo valor absoluto; "relative" = taxa/100k (óbitos) ou per capita (custos) */
  escala: MapScaleMode;
  minV: number;
  maxV: number;
  /** Quantidade de municípios com dado válido na escala relativa */
  relativeCount: number;
}

function legendTitle(metrica: string, escala: MapScaleMode): string {
  if (escala === "total") {
    return metrica === "custos" ? "Escala (R$ total)" : "Escala (óbitos)";
  }
  return metrica === "custos"
    ? "Escala (R$ per capita)"
    : "Escala (óbitos / 100 mil hab.)";
}

function fmtMinMax(metrica: string, escala: MapScaleMode, v: number): string {
  if (escala === "total") {
    return metrica === "custos" ? formatCurrency(v) : formatNumber(Math.round(v));
  }
  if (metrica === "custos") {
    return formatCurrency(v);
  }
  return `${formatTaxa100k(v)}`;
}

export default function MapLegend({
  metrica,
  escala,
  minV,
  maxV,
  relativeCount,
}: Props) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const title = legendTitle(metrica, escala);
  const low = relativeCount > 0 ? fmtMinMax(metrica, escala, minV) : "—";
  const high = relativeCount > 0 ? fmtMinMax(metrica, escala, maxV) : "—";
  const empty = relativeCount === 0;

  return (
    <div
      className="flex min-w-[200px] flex-col gap-1.5 rounded-lg px-3 py-2"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--fg-secondary)" }}
      >
        {title}
      </span>
      {empty ? (
        <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
          {escala === "relative"
            ? "Sem indicador relativo (população ausente ou fora do filtro). Rode o job IBGE."
            : "Nenhum município com valores neste filtro."}
        </span>
      ) : (
        <>
          <span
            className="text-[9px] leading-tight"
            style={{ color: "var(--fg-muted)" }}
          >
            Faixa conforme mín./máx. dos municípios exibidos (filtro atual).
          </span>
          <div
            className="h-3 w-full max-w-[240px] rounded-full"
            style={{ background: mapChoroplethGradientCss(dark) }}
          />
          <div
            className="flex max-w-[240px] justify-between text-[10px] tabular-nums"
            style={{ color: "var(--fg-muted)" }}
          >
            <span>{low}</span>
            <span>{high}</span>
          </div>
        </>
      )}
    </div>
  );
}
