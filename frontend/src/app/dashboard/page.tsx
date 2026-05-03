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
import type { DashboardData, FilterValues, Municipio } from "@/lib/types";

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#6366f1"];
const SEXO_COLORS: Record<string, string> = { Masculino: "#3b82f6", Feminino: "#ec4899" };
const REGIOES = {
    "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Sudeste": ["ES", "MG", "RJ", "SP"],
    "Sul": ["PR", "RS", "SC"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
};


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
  const [ufs, setUfs] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<FilterValues>({ dimensao: 'ocorrencia' });
  const [loading, setLoading] = useState(true);

  // This single effect manages all data loading based on filters.
  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      // Don't fetch main data until a year is selected.
      if (!filters.ano) {
        // Fetch initial filter options only
        const [a, t] = await Promise.all([fetchAnos(), fetchTiposVeiculo()]);
        if (cancelled) return;
        setAnos(a.anos);
        setTipos(t.tipos);
        if (a.anos.length > 0) {
          setFilters(f => ({ ...f, ano: a.anos.at(-1) }));
        }
        return;
      }
      
      setLoading(true);

      const summaryPromise = fetchSummary(filters);
      const municipiosPromise = fetchMunicipios({ ano: filters.ano, uf: filters.uf, regiao: filters.regiao, dimensao: filters.dimensao });

      const [summaryData, municipiosData] = await Promise.all([summaryPromise, municipiosPromise]);
      
      if (cancelled) return;

      setData(summaryData);
      setMunicipios(municipiosData.municipios);

      // Also update the list of UFs for the filter dropdown
      const availableUfs = [...new Set(municipiosData.municipios.map(mun => mun.uf))].sort();
      setUfs(availableUfs);
      
      setLoading(false);
    }

    loadData();

    return () => { cancelled = true; };
  }, [filters]);

  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    const newFilters: FilterValues = { ...filters };

    // Handle cascading filter logic
    if (key === 'regiao') {
        newFilters.uf = undefined;
        newFilters.municipio = undefined;
        newFilters.regiao = value as FilterValues['regiao'];
    } else if (key === 'uf') {
        newFilters.municipio = undefined;
        newFilters.regiao = undefined;
        newFilters.uf = value;
    } 
    
    // Set the new value with correct types
    if (key === 'ano') {
        newFilters.ano = value ? Number(value) : undefined;
    } else if (key === 'dimensao') {
        newFilters.dimensao = value === 'residencia' ? 'residencia' : 'ocorrencia';
    } else if (key === 'municipio' || key === 'tipo_veiculo') {
        newFilters[key] = value || undefined;
    }
    
    setFilters(newFilters);
  };

  const handleReset = () => {
    const latestYear = anos.length > 0 ? anos.at(-1) : undefined;
    setFilters({ ano: latestYear, dimensao: "ocorrencia" });
  };
  
  const filterDefs = [
    { key: "dimensao", label: "Dimensão", options: [{value: "ocorrencia", label: "Ocorrência"}, {value: "residencia", label: "Residência"}] },
    { key: "regiao", label: "Região", options: Object.keys(REGIOES).map(r => ({ value: r, label: r })), placeholder: "Todas as regiões" },
    { key: "uf", label: "UF", options: ufs.map(u => ({ value: u, label: u })), placeholder: "Todos os estados" },
    { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
    { key: "municipio", label: "Município", options: municipios.map((m) => ({ value: m.cod_mun_ibge, label: m.municipio })), placeholder: "Todos os municípios" },
    { key: "tipo_veiculo", label: "Tipo Veículo", options: tipos.map((t) => ({ value: t, label: t })) },
  ];

  if (!data || loading) {
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
    name: d.tipo_veiculo,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const sexoLegend = data.obitos_por_sexo.map((d) => ({
    name: d.sexo,
    color: SEXO_COLORS[d.sexo] ?? "#6b7280",
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Painel Geral</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            DATASUS (SIM + SIA) · {data.periodo}
          </p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters as Record<string, string>}
          onChange={(k, v) => handleFilterChange(k as keyof FilterValues, v)}
          onReset={handleReset}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Óbitos"
          value={formatNumber(data.total_obitos)}
          subtitle={data.periodo}
          icon={<AlertTriangle className="h-4 w-4" />}
          semantic="deaths"
          sparkData={sparkObitos}
        />
        <KpiCard
          title="Custo SUS"
          value={formatCurrency(data.total_custos)}
          subtitle="Ambulatoriais"
          icon={<DollarSign className="h-4 w-4" />}
          semantic="costs"
          sparkData={sparkCustos}
        />
        <KpiCard
          title="Atendimentos"
          value={formatNumber(data.total_atendimentos)}
          subtitle="Registros SIA"
          icon={<Activity className="h-4 w-4" />}
          semantic="health"
        />
        <KpiCard
          title="Municípios"
          value={String(data.municipios)}
          subtitle="Com registros"
          icon={<Building2 className="h-4 w-4" />}
          semantic="success"
        />
      </div>

      {/* Séries temporais */}
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

      {/* Distribuições */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Óbitos por Tipo de Veículo">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.obitos_por_tipo_veiculo}
                dataKey="total"
                nameKey="tipo_veiculo"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={35}
                paddingAngle={2}
              >
                {data.obitos_por_tipo_veiculo.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
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
                {data.obitos_por_faixa_etaria.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Sexo">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.obitos_por_sexo}
                dataKey="total"
                nameKey="sexo"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={35}
                paddingAngle={3}
              >
                {data.obitos_por_sexo.map((d, i) => (
                  <Cell key={i} fill={SEXO_COLORS[d.sexo] ?? PIE_COLORS[i]} />
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
    </div>
  );
}
