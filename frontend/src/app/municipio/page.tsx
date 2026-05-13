"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, DollarSign, Users, Activity, BarChart3, ChevronLeft, ChevronRight,
  Download,
} from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchAnos, fetchIndicadores, fetchMunicipio, fetchMunicipios, fetchSerieDiaria,
  type IndicadoresMunicipio, type SerieDiariaResponse,
} from "@/lib/api";
import { formatCurrency, formatNumber, formatTaxa100k } from "@/lib/format";
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
  const [dataFull, setDataFull] = useState<MunicipioDetail | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresMunicipio | null>(null);
  const [serieDia, setSerieDia] = useState<SerieDiariaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [hidePico, setHidePico] = useState(false);
  const [chartAnoMin, setChartAnoMin] = useState<number | null>(null);
  const [chartAnoMax, setChartAnoMax] = useState<number | null>(null);
  const [metricaAnual, setMetricaAnual] = useState<"obitos" | "taxa">("obitos");

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
        newFilters.regiao = value ? (value as FilterValues['regiao']) : undefined;
    } else if (key === 'uf') {
        newFilters.municipio = undefined;
        newFilters.regiao = undefined;
        newFilters.uf = value || undefined;
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
    if (!municipio) {
      setData(null);
      setDataFull(null);
      setIndicadores(null);
      setSerieDia(null);
      return;
    }
    setLoading(true);
    const anoNum = ano ? Number(ano) : undefined;
    const dim = dimensao ?? "ocorrencia";
    const promisses: Promise<unknown>[] = [
      fetchMunicipio(municipio, anoNum, dim),
      fetchMunicipio(municipio, undefined, dim),
      fetchIndicadores(municipio, undefined, dim),
    ];
    if (anoNum != null && dim === "ocorrencia") {
      promisses.push(fetchSerieDiaria(municipio, anoNum, dim));
    } else {
      promisses.push(Promise.resolve(null));
    }
    Promise.all(promisses)
      .then(([d, dFull, ind, sd]) => {
        setData(d as MunicipioDetail);
        setDataFull(dFull as MunicipioDetail);
        setIndicadores(ind as IndicadoresMunicipio);
        setSerieDia(sd as SerieDiariaResponse | null);
      })
      .finally(() => setLoading(false));
  }, [filters.municipio, filters.ano, filters.dimensao]);

  useEffect(loadDetail, [loadDetail]);

  useEffect(() => {
    setChartAnoMin(null);
    setChartAnoMax(null);
    setHidePico(false);
  }, [filters.municipio]);

  const indList = indicadores?.indicadores ?? [];
  const indFocus = useMemo(() => {
    if (!indList.length) return null;
    if (filters.ano != null) {
      const hit = indList.find((i) => i.ano === filters.ano);
      if (hit) return hit;
    }
    return indList[indList.length - 1];
  }, [indList, filters.ano]);

  const anosInd = useMemo(
    () => indList.map((i) => i.ano).sort((a, b) => a - b),
    [indList]
  );

  useEffect(() => {
    if (!anosInd.length) return;
    if (chartAnoMin == null) setChartAnoMin(anosInd[0]);
    if (chartAnoMax == null) setChartAnoMax(anosInd[anosInd.length - 1]);
  }, [anosInd, chartAnoMin, chartAnoMax]);

  const indAnualFiltrado = useMemo(() => {
    const lo = chartAnoMin ?? anosInd[0] ?? 0;
    const hi = chartAnoMax ?? anosInd[anosInd.length - 1] ?? 0;
    return indList.filter((i) => i.ano >= lo && i.ano <= hi);
  }, [indList, chartAnoMin, chartAnoMax, anosInd]);

  const mensalFiltrado = useMemo(() => {
    const rows = dataFull?.serie_obitos ?? [];
    const lo = chartAnoMin ?? -Infinity;
    const hi = chartAnoMax ?? Infinity;
    return rows.filter((r) => {
      const y = parseInt(String(r.competencia).slice(0, 4), 10);
      return !Number.isNaN(y) && y >= lo && y <= hi;
    });
  }, [dataFull, chartAnoMin, chartAnoMax]);

  const pontosDiarios = useMemo(() => {
    const pts = serieDia?.pontos ?? [];
    if (!hidePico || !serieDia?.resumo?.dia_pico) return pts;
    const pico = serieDia.resumo.dia_pico;
    return pts.filter((p) => p.data !== pico);
  }, [serieDia, hidePico]);

  const exportCsvAnual = () => {
    const rows = indAnualFiltrado;
    if (!rows.length) return;
    const hdr = [
      "ano",
      "obitos",
      "taxa_obitos_100mil",
      "frota_total",
      "taxa_obitos_por_10mil_veiculos",
    ];
    const lines = [
      hdr.join(","),
      ...rows.map((r) =>
        [
          r.ano,
          r.obitos,
          r.taxa_obitos_100mil,
          r.frota_total ?? "",
          r.taxa_obitos_por_10mil_veiculos ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `indicadores_${filters.municipio}_anual.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
        values={{
          dimensao: filters.dimensao ?? "ocorrencia",
          regiao: filters.regiao ?? "",
          uf: filters.uf ?? "",
          ano: filters.ano != null ? String(filters.ano) : "",
          municipio: filters.municipio ?? "",
        }}
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
            <KpiCard title="Taxa Mortalidade" value={indFocus ? formatTaxa100k(indFocus.taxa_obitos_100mil) : "—"}
              subtitle="por 100 mil hab" icon={<BarChart3 className="h-4 w-4" />} semantic="deaths" />
            <KpiCard title="Custo Total SUS" value={formatCurrency(data.total_custos)}
              subtitle="Ambulatoriais" icon={<DollarSign className="h-4 w-4" />} semantic="costs" />
            <KpiCard title="Custo per capita" value={indFocus ? `R$ ${indFocus.custo_per_capita.toFixed(2)}` : "—"}
              subtitle="por habitante" icon={<DollarSign className="h-4 w-4" />} semantic="costs" />
          </div>

          {indFocus && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard title="População Estimada" value={formatNumber(indFocus.populacao)}
                subtitle="IBGE Tabela 6579" icon={<Users className="h-4 w-4" />} semantic="health" />
              <KpiCard title="Atendimentos" value={formatNumber(data.total_atendimentos)}
                subtitle="Registros SIA" icon={<Activity className="h-4 w-4" />} semantic="health" />
              <KpiCard title="Taxa Atendimentos" value={`${indFocus.taxa_atend_100mil}`}
                subtitle="por 100 mil hab" icon={<BarChart3 className="h-4 w-4" />} semantic="success" />
              {indFocus.frota_total != null && indFocus.frota_total > 0 ? (
                <>
                  <KpiCard title="Frota (SENATRAN)" value={formatNumber(indFocus.frota_total)}
                    subtitle="veículos no ano de referência" icon={<BarChart3 className="h-4 w-4" />} semantic="health" />
                  <KpiCard title="Óbitos / 10k veíc."
                    value={indFocus.taxa_obitos_por_10mil_veiculos != null ? formatTaxa100k(indFocus.taxa_obitos_por_10mil_veiculos) : "—"}
                    subtitle="taxa ajustada à frota" icon={<AlertTriangle className="h-4 w-4" />} semantic="deaths" />
                </>
              ) : null}
            </div>
          )}

          {indicadores?.dimensao_ativa && (
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Dimensão SIM: <strong>{indicadores.dimensao_ativa}</strong>
              {indicadores.dimensao_ativa === "residencia"
                ? " — série diária só está disponível para ocorrência."
                : null}
            </p>
          )}

          {anosInd.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase" style={{ color: "var(--fg-muted)" }}>Gráficos: ano inicial</span>
                <select
                  value={chartAnoMin ?? ""}
                  onChange={(e) => setChartAnoMin(Number(e.target.value))}
                  className="h-9 rounded-lg px-2 text-sm"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
                >
                  {anosInd.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase" style={{ color: "var(--fg-muted)" }}>ano final</span>
                <select
                  value={chartAnoMax ?? ""}
                  onChange={(e) => setChartAnoMax(Number(e.target.value))}
                  className="h-9 rounded-lg px-2 text-sm"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
                >
                  {anosInd.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => { exportCsvAnual(); }}
                className="mt-5 flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--fg-secondary)" }}
              >
                <Download className="h-3.5 w-3.5" /> CSV anual
              </button>
            </div>
          )}

          {indAnualFiltrado.length > 0 && (
            <ChartCard title="Indicadores anuais (série longa)">
              <div className="mb-2 flex gap-2">
                <button type="button" onClick={() => setMetricaAnual("obitos")}
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: metricaAnual === "obitos" ? "var(--primary)" : "var(--bg-muted)",
                    color: metricaAnual === "obitos" ? "var(--primary-fg)" : "var(--fg-secondary)",
                  }}
                >Óbitos</button>
                <button type="button" onClick={() => setMetricaAnual("taxa")}
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: metricaAnual === "taxa" ? "var(--primary)" : "var(--bg-muted)",
                    color: metricaAnual === "taxa" ? "var(--primary-fg)" : "var(--fg-secondary)",
                  }}
                >Taxa / 100k</button>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indAnualFiltrado.map((r) => ({
                    ano: String(r.ano),
                    v: metricaAnual === "obitos" ? r.obitos : r.taxa_obitos_100mil,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
                    <Tooltip
                      {...tooltipProps}
                      formatter={(v) => [
                        metricaAnual === "taxa" ? formatTaxa100k(Number(v ?? 0)) : formatNumber(Number(v ?? 0)),
                        metricaAnual === "taxa" ? "/100k" : "óbitos",
                      ]}
                    />
                    <Bar dataKey="v" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {mensalFiltrado.length > 0 && (
            <ChartCard title="Óbitos por mês (competência)">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mensalFiltrado.map((r) => ({ t: r.competencia, v: r.valor }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--fg-muted)" }} angle={-35} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
                    <Tooltip {...tooltipProps} formatter={(v) => [formatNumber(Number(v ?? 0)), "óbitos"]} />
                    <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="color-mix(in srgb, var(--primary) 35%, transparent)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {data?.obitos_por_tipo_veiculo && data.obitos_por_tipo_veiculo.length > 0 && (
            <ChartCard title="Óbitos por tipo de veículo (agregado no período filtrado no topo)">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.obitos_por_tipo_veiculo} dataKey="total" nameKey="tipo_veiculo" cx="50%" cy="50%" outerRadius={80} label>
                      {data.obitos_por_tipo_veiculo.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v) => formatNumber(Number(v ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {serieDia?.serie_diaria_disponivel && serieDia.pontos.length > 0 && (
            <ChartCard title={`Óbitos por dia — ${serieDia.ano}`}>
              {serieDia.resumo?.alerta_concentracao && (
                <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "color-mix(in srgb, var(--deaths) 15%, transparent)", border: "1px solid var(--border)" }}>
                  <strong>Concentração temporal:</strong> {formatTaxa100k(serieDia.resumo.share_obitos_no_dia_pico * 100)}% dos óbitos do ano no dia {serieDia.resumo.dia_pico}. Compare com a série mensal para contexto.
                </div>
              )}
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--fg-secondary)" }}>
                <input type="checkbox" checked={hidePico} onChange={(e) => setHidePico(e.target.checked)} />
                Ocultar o dia de pico no gráfico (apenas visualização)
              </label>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pontosDiarios.filter((p) => p.obitos > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="data" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} angle={-45} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
                    <Tooltip {...tooltipProps} formatter={(v) => [formatNumber(Number(v ?? 0)), "óbitos"]} />
                    <Bar dataKey="obitos" fill="var(--deaths)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {serieDia && !serieDia.serie_diaria_disponivel && serieDia.motivo && (
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{serieDia.motivo}</p>
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
