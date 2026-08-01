"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Building2, Database, MapPinned } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import { fetchSimAnos, fetchSimMunicipios, fetchSimSummary, fetchSimTipos } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { FilterValues, SimMunicipio, SimSummary } from "@/lib/types";

const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterValues>({ dimensao: "ocorrencia" });
  const [data, setData] = useState<SimSummary | null>(null);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dimensao = filters.dimensao ?? "ocorrencia";
    Promise.all([fetchSimAnos(dimensao), fetchSimTipos(dimensao)])
      .then(([years, vehicleTypes]) => {
        setAnos(years.anos);
        setTipos(vehicleTypes.tipos);
        if (!filters.ano && years.anos.length) {
          setFilters((current) => ({ ...current, ano: years.anos.at(-1) }));
        }
      })
      .catch(() => setError("Nao foi possivel carregar os filtros do SIM."));
  }, [filters.dimensao, filters.ano]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSimSummary(filters),
      fetchSimMunicipios(filters, 1, 200),
    ])
      .then(([summary, rows]) => {
        if (cancelled) return;
        setData(summary);
        setMunicipios(rows.municipios);
        setUfs([...new Set(rows.municipios.map((row) => row.uf))].sort());
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Nao foi possivel carregar os dados do SIM.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  const handleChange = (key: string, value: string) => {
    setFilters((current) => {
      const next = { ...current };
      if (key === "dimensao") next.dimensao = value === "residencia" ? "residencia" : "ocorrencia";
      if (key === "ano") next.ano = value ? Number(value) : undefined;
      if (key === "uf") { next.uf = value || undefined; next.regiao = undefined; }
      if (key === "regiao") { next.regiao = value || undefined; next.uf = undefined; }
      if (key === "tipo_veiculo") next.tipo_veiculo = value || undefined;
      return next;
    });
  };

  const topMunicipios = useMemo(() => municipios.slice(0, 10), [municipios]);
  const filterDefs = [
    { key: "dimensao", label: "Dimensao", options: [{ value: "ocorrencia", label: "Ocorrencia" }, { value: "residencia", label: "Residencia" }] },
    { key: "regiao", label: "Regiao", options: REGIOES.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "uf", label: "UF", options: ufs.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "ano", label: "Ano", options: anos.map((value) => ({ value: String(value), label: String(value) })) },
    { key: "tipo_veiculo", label: "Veiculo", options: tipos.map((value) => ({ value, label: value })), placeholder: "Todos" },
  ];

  if (loading && !data) return <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>Carregando dados do SIM...</div>;
  if (error && !data) return <div className="rounded-xl p-6 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--danger)" }}>{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Painel SIM</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Mortalidade por acidentes de transporte terrestre - {data.periodo}</p>
        </div>
        <FilterBar filters={filterDefs} values={filters as Record<string, string>} onChange={handleChange} onReset={() => setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) })} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Obitos ATT" value={formatNumber(data.total_obitos)} subtitle={data.dimensao} icon={<AlertTriangle className="h-4 w-4" />} semantic="deaths" />
        <KpiCard title="Municipios" value={formatNumber(data.municipios)} subtitle="com registro" icon={<Building2 className="h-4 w-4" />} semantic="success" />
        <KpiCard title="Fonte" value="SIM" subtitle="DATASUS" icon={<Database className="h-4 w-4" />} semantic="health" />
        <KpiCard title="Geografia" value={data.dimensao} subtitle="papel analitico" icon={<MapPinned className="h-4 w-4" />} semantic="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolucao anual" subtitle="Obitos com causa V01-V89 e QA aprovado">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.obitos_por_ano}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), "Obitos"]} />
              <Line type="monotone" dataKey="total" stroke="var(--deaths)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Municipios com maior numero de Obitos" subtitle="Ordenacao pelo filtro atual">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topMunicipios} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
              <YAxis type="category" dataKey="municipio" width={110} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), "Obitos"]} />
              <Bar dataKey="obitos" fill="var(--deaths)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl p-4 text-xs" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>
        Populacao e frota so geram taxas quando o denominador do mesmo municipio e ano esta disponivel. Nesta versao, a frota SENATRAN permanece {data.denominadores.frota}.
      </div>
    </div>
  );
}
