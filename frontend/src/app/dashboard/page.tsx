"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import { fetchAnos, fetchMunicipios, fetchSummary, fetchTiposVeiculo } from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardData, Municipio } from "@/lib/types";

const COLORS = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#f97316","#6366f1"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAnos(), fetchMunicipios(), fetchTiposVeiculo()]).then(
      ([a, m, t]) => { setAnos(a.anos); setMunicipios(m.municipios); setTipos(t.tipos); }
    );
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchSummary({
      ano: filters.ano ? Number(filters.ano) : undefined,
      municipio: filters.municipio || undefined,
      tipo_veiculo: filters.tipo_veiculo || undefined,
    })
      .then(setData)
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  const filterDefs = [
    { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
    { key: "municipio", label: "Municipio", options: municipios.map((m) => ({ value: m.cod_mun_ibge, label: m.municipio })), placeholder: "Todos os municipios" },
    { key: "tipo_veiculo", label: "Tipo Veiculo", options: tipos.map((t) => ({ value: t, label: t })) },
  ];

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Painel Geral</h1>
          <p className="text-xs text-slate-400">DATASUS (SIM + SIA) - {data.periodo}</p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onReset={() => setFilters({})}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Obitos" value={formatNumber(data.total_obitos)} subtitle={data.periodo} icon={<AlertIcon />} color="red" />
        <KpiCard title="Custo SUS" value={formatCurrency(data.total_custos)} subtitle="Ambulatoriais" icon={<DollarIcon />} color="amber" />
        <KpiCard title="Atendimentos" value={formatNumber(data.total_atendimentos)} subtitle="Registros SIA" icon={<HospitalIcon />} color="blue" />
        <KpiCard title="Municipios" value={String(data.municipios)} subtitle="Com registros" icon={<PinIcon />} color="emerald" />
      </div>

      {/* Series */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolucao de Obitos" subtitle="Serie mensal">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.serie_temporal_obitos}>
              <defs><linearGradient id="gO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="competencia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
              <Area type="monotone" dataKey="valor" stroke="#ef4444" fill="url(#gO)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolucao de Custos (R$)" subtitle="Serie mensal">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.serie_temporal_custos}>
              <defs><linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="competencia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Custo"]} />
              <Area type="monotone" dataKey="valor" stroke="#f59e0b" fill="url(#gC)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Obitos por Tipo de Veiculo">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.obitos_por_tipo_veiculo} dataKey="total" nameKey="tipo_veiculo" cx="50%" cy="50%" outerRadius={85} innerRadius={40} paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {data.obitos_por_tipo_veiculo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Obitos por Faixa Etaria">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="faixa_etaria" type="category" tick={{ fontSize: 11 }} width={45} />
              <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.obitos_por_faixa_etaria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Municipios — Obitos">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_municipio} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="municipio" type="category" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.obitos_por_municipio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Annual + costs by municipality */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 Municipios — Custos" subtitle="Impacto financeiro ao SUS">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.custos_por_municipio} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
              <YAxis dataKey="municipio" type="category" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Custo"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolucao Anual">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_ano}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
              <Legend />
              <Bar dataKey="total" name="Obitos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function AlertIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>; }
function DollarIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function HospitalIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>; }
function PinIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" /></svg>; }
