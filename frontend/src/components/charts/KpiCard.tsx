"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

type Semantic = "deaths" | "costs" | "health" | "success";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  semantic: Semantic;
  trend?: { value: number; label?: string };
  sparkData?: number[];
}

const tokens: Record<Semantic, { color: string; softVar: string; glowVar: string; sparkColor: string }> = {
  deaths:  { color: "var(--deaths)",  softVar: "var(--deaths-soft)",  glowVar: "var(--shadow-glow-deaths)", sparkColor: "#ef4444" },
  costs:   { color: "var(--costs)",   softVar: "var(--costs-soft)",   glowVar: "var(--shadow-glow-costs)",  sparkColor: "#f59e0b" },
  health:  { color: "var(--health)",  softVar: "var(--health-soft)",  glowVar: "none",                      sparkColor: "#3b82f6" },
  success: { color: "var(--success)", softVar: "var(--success-soft)", glowVar: "none",                      sparkColor: "#10b981" },
};

function TrendBadge({ value, label }: { value: number; label?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        positive ? "text-red-600" : "text-emerald-600"
      )}
      style={{
        backgroundColor: positive ? "var(--deaths-soft)" : "var(--success-soft)",
      }}
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="currentColor">
        {positive ? (
          <path d="M6 2l4 5H2z" />
        ) : (
          <path d="M6 10l4-5H2z" />
        )}
      </svg>
      {Math.abs(value).toFixed(1)}%{label ? ` ${label}` : ""}
    </span>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/g, "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function KpiCard({ title, value, subtitle, icon, semantic, trend, sparkData }: Props) {
  const t = tokens[semantic];

  return (
    <div
      className="group relative overflow-hidden rounded-xl p-4 transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: t.color }}>
            {value}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {subtitle && (
              <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{subtitle}</span>
            )}
            {trend && <TrendBadge value={trend.value} label={trend.label} />}
          </div>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: t.softVar, color: t.color }}
        >
          {icon}
        </div>
      </div>

      {sparkData && sparkData.length > 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparkData} color={t.sparkColor} />
        </div>
      )}
    </div>
  );
}
