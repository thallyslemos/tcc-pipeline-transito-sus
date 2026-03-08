"use client";

import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, DollarSign, Building2, Activity } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import { fetchAnos, fetchMunicipios, fetchSummary, fetchTiposVeiculo } from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardData, Municipio } from "@/lib/types";

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#6366f1"];
const SEXO_COLORS: Record<string, string> = { Masculino: "#3b82f6", Feminino: "#ec4899" };

function ThemedTooltip(props: Record<string, unknown>) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--fg)",
        boxShadow: "var(--shadow-md)",
      }}
      itemStyle={{ color: "var(--fg)" }}
      labelStyle={{ color: "var(--fg)", fontWeight: 600 }}
    />
  );
}

function SemanticLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-[11px]" style={{ color: "var(--fg-secondary)" }}>{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAnos(), fetchMunicipios(), fetchTiposVeiculo()]).then(
      ([a, m, t]) => {
        if (!cancelled) {
          setAnos(a.anos);
          setMunicipios(m.municipios);
          setTipos(t.tipos);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSummary({
      ano: filters.ano ? Number(filters.ano) : undefined,
      municipio: filters.municipio || undefined,
      tipo_veiculo: filters.tipo_veiculo || undefined,
    })
      .then((data) => { if (!cancelled) setData(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const municipiosUnicos = municipios.filter(
    (m, i, arr) => arr.findIndex((x) => x.cod_mun_ibge === m.cod_mun_ibge) === i
  );
  const filterDefs = [
    { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
    { key: "municipio", label: "Município", options: municipiosUnicos.map((m) => ({ value: m.cod_mun_ibge, label: m.municipio })), placeholder: "Todos os municípios" },
    { key: "tipo_veiculo", label: "Tipo Veículo", options: tipos.map((t) => ({ value: t, label: t })) },
  ];

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Carregando painel...</p>
        </div>
      </div>
    );
  }

  const sparkObitos = data.serie_temporal_obitos.map((s) => s.valor);
  const sparkCustos = data.serie_temporal_custos.map((s) => s.valor);

  const veiculoLegend = data.obitos_por_tipo_veiculo.map((d, i) => ({
    name: d.tipo_veiculo, color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const sexoLegend = data.obitos_por_sexo.map((d) => ({
    name: d.sexo, color: SEXO_COLORS[d.sexo] || "#6b7280",
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Painel Geral</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            DATASUS (SIM + SIA) · {data.periodo}
          </p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onReset={() => setFilters({})}
        />
      </div>

      {/* Narrative KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Óbitos" value={formatNumber(data.total_obitos)} subtitle={data.periodo}
          icon={<AlertTriangle className="h-4 w-4" />} semantic="deaths" sparkData={sparkObitos} />
        <KpiCard title="Custo SUS" value={formatCurrency(data.total_custos)} subtitle="Ambulatoriais"
          icon={<DollarSign className="h-4 w-4" />} semantic="costs" sparkData={sparkCustos} />
        <KpiCard title="Atendimentos" value={formatNumber(data.total_atendimentos)} subtitle="Registros SIA"
          icon={<Activity className="h-4 w-4" />} semantic="health" />
        <KpiCard title="Municípios" value={String(data.municipios)} subtitle="Com registros"
          icon={<Building2 className="h-4 w-4" />} semantic="success" />
      </div>

      {/* Time Series */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolução de Óbitos" subtitle="Série mensal">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.serie_temporal_obitos}>
              <defs>
                <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--deaths)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--deaths)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
              <Area type="monotone" dataKey="valor" stroke="var(--deaths)" fill="url(#gO)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução de Custos (R$)" subtitle="Série mensal">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.serie_temporal_custos}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--costs)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--costs)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} tickFormatter={(v) => formatCompact(v)} />
              <ThemedTooltip formatter={(v: number) => [formatCurrency(Number(v)), "Custo"]} />
              <Area type="monotone" dataKey="valor" stroke="var(--costs)" fill="url(#gC)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Distributions — external legends, no overlapping labels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Óbitos por Tipo de Veículo">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.obitos_por_tipo_veiculo} dataKey="total" nameKey="tipo_veiculo"
                cx="50%" cy="50%" outerRadius={75} innerRadius={35} paddingAngle={2}>
                {data.obitos_por_tipo_veiculo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
            </PieChart>
          </ResponsiveContainer>
          <SemanticLegend items={veiculoLegend} />
        </ChartCard>

        <ChartCard title="Óbitos por Faixa Etária">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <YAxis dataKey="faixa_etaria" type="category" tick={{ fontSize: 11, fill: "var(--chart-text)" }} width={45} />
              <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.obitos_por_faixa_etaria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Sexo">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.obitos_por_sexo} dataKey="total" nameKey="sexo"
                cx="50%" cy="50%" outerRadius={75} innerRadius={35} paddingAngle={3}>
                {data.obitos_por_sexo.map((d, i) => (
                  <Cell key={i} fill={SEXO_COLORS[d.sexo] || PIE_COLORS[i]} />
                ))}
              </Pie>
              <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
            </PieChart>
          </ResponsiveContainer>
          <SemanticLegend items={sexoLegend} />
        </ChartCard>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 Municípios — Óbitos" subtitle="Maior impacto em vidas">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_municipio} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
              <YAxis dataKey="municipio" type="category" tick={{ fontSize: 10, fill: "var(--chart-text)" }} width={110} />
              <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="var(--deaths)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Municípios — Custos" subtitle="Impacto financeiro ao SUS">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.custos_por_municipio} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={(v) => formatCompact(v)} />
              <YAxis dataKey="municipio" type="category" tick={{ fontSize: 10, fill: "var(--chart-text)" }} width={110} />
              <ThemedTooltip formatter={(v: number) => [formatCurrency(Number(v)), "Custo"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="var(--costs)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Annual Evolution */}
      <ChartCard title="Evolução Anual" subtitle="Comparativo por ano">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.obitos_por_ano}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
            <ThemedTooltip formatter={(v: number) => [formatNumber(Number(v)), "Óbitos"]} />
            <Legend wrapperStyle={{ color: "var(--fg-secondary)" }} />
            <Bar dataKey="total" name="Óbitos" fill="var(--deaths)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
