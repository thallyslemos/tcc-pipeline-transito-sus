"use client";

import {
  Area, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface HistoricoPoint {
  competencia: string;
  valor: number;
}

interface PrevisaoPoint {
  competencia: string;
  valor: number;
  lower: number;
  upper: number;
}

interface Props {
  historico: HistoricoPoint[];
  previsao: PrevisaoPoint[];
  metrica: "obitos" | "custos";
  height?: number;
}

export default function ForecastChart({ historico, previsao, metrica, height = 360 }: Props) {
  const lastHist = historico[historico.length - 1];

  const data = [
    ...historico.map((h) => ({
      competencia: h.competencia,
      real: h.valor,
      previsao: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
      band: null as [number, number] | null,
    })),
    {
      competencia: lastHist.competencia,
      real: lastHist.valor,
      previsao: lastHist.valor,
      lower: lastHist.valor,
      upper: lastHist.valor,
      band: [lastHist.valor, lastHist.valor] as [number, number],
    },
    ...previsao.map((p) => ({
      competencia: p.competencia,
      real: null as number | null,
      previsao: p.valor,
      lower: p.lower,
      upper: p.upper,
      band: [p.lower, p.upper] as [number, number],
    })),
  ];

  const isCurrency = metrica === "custos";

  const fmtValue = (v: number) => {
    if (isCurrency) {
      if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
      return `R$ ${v.toFixed(0)}`;
    }
    return String(Math.round(v));
  };

  const fmtTick = (v: number) => {
    if (isCurrency) {
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
      return String(v);
    }
    return String(Math.round(v));
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="competencia"
          tick={{ fontSize: 10, fill: "var(--chart-text)" }}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 10))}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--chart-text)" }}
          tickLine={false}
          tickFormatter={fmtTick}
          width={55}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-card)",
            color: "var(--fg)",
            fontSize: 12,
            boxShadow: "var(--shadow-md)",
          }}
          formatter={(value, name) => {
            if (name === "band" || value == null) return [null, null];
            return [fmtValue(Number(value)), name === "real" ? "Dados Reais" : "Previsão IA"];
          }}
          labelStyle={{ fontWeight: 600, color: "var(--fg)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--fg-secondary)" }}
          formatter={(value: string) => {
            if (value === "real") return "Dados Reais";
            if (value === "previsao") return "Previsão IA (TimesFM)";
            if (value === "band") return "Intervalo de Confiança (P10–P90)";
            return value;
          }}
        />

        <Area
          dataKey="band"
          fill={isCurrency ? "var(--costs-glow)" : "var(--deaths-glow)"}
          stroke="none"
          fillOpacity={0.6}
          name="band"
          connectNulls={false}
        />

        <Line dataKey="real" stroke="var(--primary)" strokeWidth={2} dot={false} name="real" connectNulls={false} />
        <Line
          dataKey="previsao"
          stroke={isCurrency ? "var(--costs)" : "var(--deaths)"}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          name="previsao"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
