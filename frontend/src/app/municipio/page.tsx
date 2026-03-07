"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, DollarSign, Users, Activity, BarChart3, ChevronLeft, ChevronRight,
} from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchAnos, fetchIndicadores, fetchMunicipio, fetchMunicipios,
  type IndicadoresMunicipio,
} from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { Municipio, MunicipioDetail } from "@/lib/types";

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#6366f1"];
const SEXO_COLORS: Record<string, string> = { Masculino: "#3b82f6", Feminino: "#ec4899" };
const PAGE_SIZE = 24;

export default function MunicipioPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [selectedMun, setSelectedMun] = useState("");
  const [selectedAno, setSelectedAno] = useState("");
  const [data, setData] = useState<MunicipioDetail | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresMunicipio | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([fetchMunicipios(), fetchAnos()]).then(([m, a]) => {
      setMunicipios(m.municipios);
      setAnos(a.anos);
    });
  }, []);

  const load = useCallback(() => {
    if (!selectedMun) { setData(null); setIndicadores(null); return; }
    setLoading(true);
    const anoNum = selectedAno ? Number(selectedAno) : undefined;
    Promise.all([
      fetchMunicipio(selectedMun, anoNum),
      fetchIndicadores(selectedMun, anoNum),
    ])
      .then(([d, ind]) => { setData(d); setIndicadores(ind); })
      .finally(() => setLoading(false));
  }, [selectedMun, selectedAno]);

  useEffect(load, [load]);

  const lastInd = indicadores?.indicadores?.at(-1);

  const filtered = search
    ? municipios.filter((m) => m.municipio.toLowerCase().includes(search.toLowerCase()))
    : municipios;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const tooltipStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--fg)",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Visão por Município</h1>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Selecione um município para ver indicadores relativos
        </p>
      </div>

      <FilterBar
        filters={[
          { key: "municipio", label: "Município", options: municipios.map((m) => ({ value: m.cod_mun_ibge, label: `${m.municipio} (${m.uf})` })), placeholder: "Selecione..." },
          { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
        ]}
        values={{ municipio: selectedMun, ano: selectedAno }}
        onChange={(k, v) => { if (k === "municipio") setSelectedMun(v); else setSelectedAno(v); }}
        onReset={() => { setSelectedMun(""); setSelectedAno(""); }}
      />

      {/* Municipality Grid with Pagination */}
      {!selectedMun && (
        <>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-9 w-full max-w-xs rounded-lg px-3 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--tw-ring-color" as any]: "var(--primary)",
              }}
            />
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--fg-muted)" }}>
              {filtered.length} municípios
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((m) => (
              <button key={m.cod_mun_ibge} onClick={() => setSelectedMun(m.cod_mun_ibge)}
                className="rounded-xl p-4 text-left transition-all hover:shadow-md"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--fg)" }}>{m.municipio}</p>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{m.uf} · IBGE {m.cod_mun_ibge}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: "var(--deaths)" }}>
                      {formatNumber(m.obitos || 0)}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>óbitos</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--border)", color: "var(--fg-secondary)" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--border)", color: "var(--fg-secondary)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
        </div>
      )}

      {data && indicadores && !loading && (
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-xl p-5 text-white"
            style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{data.municipio}</h2>
                <p className="text-sm text-slate-300">
                  {indicadores.uf} · {indicadores.regiao} · IBGE {data.cod_mun_ibge}
                </p>
              </div>
              <div className="flex gap-4 text-right text-xs text-slate-300">
                <div><span className="block text-white font-medium">{indicadores.idh}</span>IDH</div>
                <div><span className="block text-white font-medium">R$ {formatNumber(indicadores.pib_per_capita)}</span>PIB per capita</div>
                <div><span className="block text-white font-medium">{formatNumber(indicadores.area_km2)} km²</span>Área</div>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Óbitos" value={formatNumber(data.total_obitos)} subtitle="Total absoluto"
              icon={<AlertTriangle className="h-4 w-4" />} semantic="deaths" />
            <KpiCard title="Taxa Mortalidade" value={lastInd ? `${lastInd.taxa_obitos_100mil}` : "—"}
              subtitle="por 100 mil hab" icon={<BarChart3 className="h-4 w-4" />} semantic="deaths" />
            <KpiCard title="Custo Total SUS" value={formatCurrency(data.total_custos)}
              subtitle="Ambulatoriais" icon={<DollarSign className="h-4 w-4" />} semantic="costs" />
            <KpiCard title="Custo per capita" value={lastInd ? `R$ ${lastInd.custo_per_capita.toFixed(2)}` : "—"}
              subtitle="por habitante" icon={<DollarSign className="h-4 w-4" />} semantic="costs" />
          </div>

          {lastInd && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <KpiCard title="População Estimada" value={formatNumber(lastInd.populacao)}
                subtitle="IBGE Tabela 6579" icon={<Users className="h-4 w-4" />} semantic="health" />
              <KpiCard title="Atendimentos" value={formatNumber(data.total_atendimentos)}
                subtitle="Registros SIA" icon={<Activity className="h-4 w-4" />} semantic="health" />
              <KpiCard title="Taxa Atendimentos" value={`${lastInd.taxa_atend_100mil}`}
                subtitle="por 100 mil hab" icon={<BarChart3 className="h-4 w-4" />} semantic="success" />
            </div>
          )}

          {/* Rate evolution */}
          {indicadores.indicadores.length > 1 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Taxa de Mortalidade por 100 mil hab" subtitle="Evolução anual · Metodologia DATASUS">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={indicadores.indicadores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "por 100mil hab"]} />
                    <Line type="monotone" dataKey="taxa_obitos_100mil" stroke="var(--deaths)" strokeWidth={2} dot={{ r: 4, fill: "var(--deaths)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Custo per capita (R$)" subtitle="Evolução anual · Custo SUS / População IBGE">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={indicadores.indicadores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, "per capita"]} />
                    <Line type="monotone" dataKey="custo_per_capita" stroke="var(--costs)" strokeWidth={2} dot={{ r: 4, fill: "var(--costs)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Monthly series */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Série de Óbitos" subtitle="Evolução mensal">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.serie_obitos}>
                  <defs><linearGradient id="gMO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--deaths)" stopOpacity={0.2}/><stop offset="95%" stopColor="var(--deaths)" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), "Óbitos"]} />
                  <Area type="monotone" dataKey="valor" stroke="var(--deaths)" fill="url(#gMO)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Série de Custos" subtitle="Evolução mensal">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.serie_custos}>
                  <defs><linearGradient id="gMC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--costs)" stopOpacity={0.2}/><stop offset="95%" stopColor="var(--costs)" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatCurrency(Number(v)), "Custo"]} />
                  <Area type="monotone" dataKey="valor" stroke="var(--costs)" fill="url(#gMC)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartCard title="Por Tipo de Veículo">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.obitos_por_tipo_veiculo} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                  <YAxis dataKey="tipo_veiculo" type="category" tick={{ fontSize: 9, fill: "var(--chart-text)" }} width={80} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), "Óbitos"]} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="var(--deaths)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por Faixa Etária">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                  <YAxis dataKey="faixa_etaria" type="category" tick={{ fontSize: 10, fill: "var(--chart-text)" }} width={40} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), "Óbitos"]} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.obitos_por_faixa_etaria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por Sexo">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.obitos_por_sexo} dataKey="total" nameKey="sexo"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={30} paddingAngle={3}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.obitos_por_sexo.map((d, i) => (
                      <Cell key={i} fill={SEXO_COLORS[d.sexo] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), "Óbitos"]} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Sources */}
          {indicadores.fontes && (
            <div className="rounded-xl p-4 text-xs"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--fg)" }}>Fontes e Metodologia</p>
              <ul className="space-y-1">
                {Object.entries(indicadores.fontes).map(([k, v]) => (
                  <li key={k}><span className="font-medium" style={{ color: "var(--fg)" }}>{k.replace(/_/g, " ")}:</span> {v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
