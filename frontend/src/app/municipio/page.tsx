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
import type { Municipio, MunicipioDetail, FilterValues } from "@/lib/types";

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#6366f1"];
const SEXO_COLORS: Record<string, string> = { Masculino: "#3b82f6", Feminino: "#ec4899" };
const PAGE_SIZE = 24;

const REGIOES = {
    "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Sudeste": ["ES", "MG", "RJ", "SP"],
    "Sul": ["PR", "RS", "SC"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
};

export default function MunicipioPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<FilterValues>({ dimensao: "ocorrencia" });
  
  const [data, setData] = useState<MunicipioDetail | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresMunicipio | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  // Initial load for filter options
  useEffect(() => {
    fetchAnos().then(a => {
        setAnos(a.anos);
        if (!filters.ano && a.anos.length > 0) {
            handleFilterChange("ano", String(a.anos.at(-1)));
        }
    });
  }, []);

  // Reactive load for the municipality grid based on filters
  useEffect(() => {
    // Do not fetch the grid if a municipality is already selected
    if (filters.municipio) {
        setMunicipios([]);
        return;
    };
    
    fetchMunicipios(filters).then(m => {
      setMunicipios(m.municipios);
      const availableUfs = [...new Set(m.municipios.map(mun => mun.uf))].sort();
      setUfs(availableUfs);
    });
  }, [filters.ano, filters.uf, filters.regiao, filters.dimensao, filters.municipio]);


  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    setPage(0);
    const newFilters: FilterValues = { ...filters };

    if (key === 'regiao') {
        newFilters.uf = undefined;
        newFilters.municipio = undefined;
        newFilters.regiao = value as FilterValues['regiao'];
    } else if (key === 'uf') {
        newFilters.municipio = undefined;
        newFilters.regiao = undefined;
        newFilters.uf = value;
    } 
    
    if (key === 'ano') {
        newFilters.ano = value ? Number(value) : undefined;
    } else if (key === 'dimensao') {
        newFilters.dimensao = value === 'residencia' ? 'residencia' : 'ocorrencia';
    } else {
        newFilters[key] = value || undefined;
    }
    
    setFilters(newFilters);
  };

  const handleReset = () => {
    const latestYear = anos.length > 0 ? anos.at(-1) : undefined;
    setFilters({ ano: latestYear, dimensao: "ocorrencia" });
  }

  // Load data for the selected municipality
  const loadDetail = useCallback(() => {
    const { municipio, ano, dimensao } = filters;
    if (!municipio) { setData(null); setIndicadores(null); return; }
    setLoading(true);
    const anoNum = ano ? Number(ano) : undefined;
    Promise.all([
      fetchMunicipio(municipio, anoNum, dimensao),
      fetchIndicadores(municipio, anoNum),
    ])
      .then(([d, ind]) => { setData(d); setIndicadores(ind); })
      .finally(() => setLoading(false));
  }, [filters.municipio, filters.ano, filters.dimensao]);

  useEffect(loadDetail, [loadDetail]);

  const lastInd = indicadores?.indicadores?.at(-1);

  const filtered = search
    ? municipios.filter((m) => m.municipio.toLowerCase().includes(search.toLowerCase()))
    : municipios;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const tooltipProps = {
    contentStyle: {
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      color: "var(--fg)",
      boxShadow: "var(--shadow-md)",
    },
    itemStyle: { color: "var(--fg)" },
    labelStyle: { color: "var(--fg)", fontWeight: 600 },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Visão por Município</h1>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Selecione um município para ver indicadores relativos ou navegue pela lista.
        </p>
      </div>

      <FilterBar
        filters={[
          { key: "dimensao", label: "Dimensão", options: [{value: "ocorrencia", label: "Ocorrência"}, {value: "residencia", label: "Residência"}] },
          { key: "regiao", label: "Região", options: Object.keys(REGIOES).map(r => ({ value: r, label: r })), placeholder: "Todas" },
          { key: "uf", label: "UF", options: ufs.map(u => ({ value: u, label: u })), placeholder: "Todos" },
          { key: "ano", label: "Ano", options: anos.map((a) => ({ value: String(a), label: String(a) })) },
          { key: "municipio", label: "Município", options: municipios.map((m) => ({ value: m.cod_mun_ibge, label: `${m.municipio} (${m.uf})` })), placeholder: "Selecione na lista..." },
        ]}
        values={filters as Record<string, string>}
        onChange={(k, v) => handleFilterChange(k as keyof FilterValues, v)}
        onReset={handleReset}
      />
      
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
        </div>
      )}

      {!loading && filters.municipio && data && indicadores && (
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-xl p-5 text-white"
            style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{data.municipio}</h2>
                <p className="text-sm text-slate-300">
                  {indicadores.uf} · {indicadores.regiao || "—"} · IBGE {data.cod_mun_ibge}
                </p>
              </div>
              <div className="flex gap-4 text-right text-xs text-slate-300">
                <div><span className="block text-white font-medium">{indicadores.idh ?? "N/D"}</span>IDH</div>
                <div><span className="block text-white font-medium">{indicadores.pib_per_capita ? `R$ ${formatNumber(indicadores.pib_per_capita)}` : "N/D"}</span>PIB per capita</div>
                <div><span className="block text-white font-medium">{indicadores.area_km2 ? `${formatNumber(indicadores.area_km2)} km²` : "N/D"}</span>Área</div>
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
        </div>
      )}

      {!loading && !filters.municipio && (
        <>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar município na lista..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-9 w-full max-w-xs rounded-lg px-3 text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--fg-muted)" }}>
              {filtered.length} municípios
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((m) => (
              <button key={m.cod_mun_ibge} onClick={() => handleFilterChange("municipio", m.cod_mun_ibge)}
                className="rounded-xl p-4 text-left transition-all hover:shadow-md"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
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
    </div>
  );
}
