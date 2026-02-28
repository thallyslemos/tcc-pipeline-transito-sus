"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import { fetchAnos, fetchMunicipio, fetchMunicipios } from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { Municipio, MunicipioDetail } from "@/lib/types";

const COLORS = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#f97316","#6366f1"];

export default function MunicipioPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [selectedMun, setSelectedMun] = useState("");
  const [selectedAno, setSelectedAno] = useState("");
  const [data, setData] = useState<MunicipioDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchMunicipios(), fetchAnos()]).then(([m, a]) => {
      setMunicipios(m.municipios);
      setAnos(a.anos);
    });
  }, []);

  const load = useCallback(() => {
    if (!selectedMun) { setData(null); return; }
    setLoading(true);
    fetchMunicipio(selectedMun, selectedAno ? Number(selectedAno) : undefined)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedMun, selectedAno]);

  useEffect(load, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Visao por Municipio</h1>
        <p className="text-xs text-slate-400">Selecione um municipio para ver as estatisticas detalhadas</p>
      </div>

      <FilterBar
        filters={[
          { key: "municipio", label: "Municipio", options: municipios.map((m) => ({ value: m.cod_mun_ibge, label: `${m.municipio} (${m.uf})` })), placeholder: "Selecione..." },
          { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
        ]}
        values={{ municipio: selectedMun, ano: selectedAno }}
        onChange={(k, v) => { if (k === "municipio") setSelectedMun(v); else setSelectedAno(v); }}
        onReset={() => { setSelectedMun(""); setSelectedAno(""); }}
      />

      {!selectedMun && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {municipios.map((m) => (
            <button
              key={m.cod_mun_ibge}
              onClick={() => setSelectedMun(m.cod_mun_ibge)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{m.municipio}</p>
                  <p className="text-xs text-slate-400">{m.uf} - IBGE {m.cod_mun_ibge}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{formatNumber(m.obitos || 0)}</p>
                  <p className="text-[10px] text-slate-400">obitos</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 p-5 text-white">
            <h2 className="text-lg font-bold">{data.municipio}</h2>
            <p className="text-sm text-slate-300">{data.uf} - IBGE {data.cod_mun_ibge}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard title="Obitos" value={formatNumber(data.total_obitos)} icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>} color="red" />
            <KpiCard title="Custo SUS" value={formatCurrency(data.total_custos)} icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color="amber" />
            <KpiCard title="Atendimentos" value={formatNumber(data.total_atendimentos)} icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>} color="blue" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Serie de Obitos" subtitle="Evolucao mensal">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.serie_obitos}>
                  <defs><linearGradient id="gMO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="competencia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
                  <Area type="monotone" dataKey="valor" stroke="#ef4444" fill="url(#gMO)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Serie de Custos" subtitle="Evolucao mensal">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.serie_custos}>
                  <defs><linearGradient id="gMC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="competencia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Custo"]} />
                  <Area type="monotone" dataKey="valor" stroke="#f59e0b" fill="url(#gMC)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartCard title="Por Tipo de Veiculo">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.obitos_por_tipo_veiculo} dataKey="total" nameKey="tipo_veiculo" cx="50%" cy="50%" outerRadius={70} innerRadius={30} paddingAngle={2}>
                    {data.obitos_por_tipo_veiculo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por Faixa Etaria">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="faixa_etaria" type="category" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.obitos_por_faixa_etaria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por Sexo">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.obitos_por_sexo} dataKey="total" nameKey="sexo" cx="50%" cy="50%" outerRadius={70} innerRadius={30} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {data.obitos_por_sexo.map((_, i) => <Cell key={i} fill={i === 0 ? "#3b82f6" : "#ec4899"} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Obitos"]} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
