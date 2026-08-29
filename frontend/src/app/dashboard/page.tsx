"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiStat from "@/components/ui/KpiStat";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimPopulacaoCobertura,
  fetchSimSummary,
  fetchSimTipos,
} from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { FilterValues, SimMunicipio, SimPopulacaoCobertura, SimSummary } from "@/lib/types";

const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];
const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];
const SEXO_COLORS: Record<string, string> = {
  Masculino: "#3b82f6",
  Feminino: "#ec4899",
  Ignorado: "#6b7280",
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
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[11px]" style={{ color: "var(--fg-secondary)" }}>
            {item.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterValues>({ dimensao: "ocorrencia" });
  const [data, setData] = useState<SimSummary | null>(null);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popCobertura, setPopCobertura] = useState<SimPopulacaoCobertura | null>(null);

  // So auto-seleciona o ultimo ano na carga inicial. Sem isto, escolher
  // "Todos" (filters.ano vira undefined) disparava este efeito de novo e
  // reescrevia o ano automaticamente, impedindo o filtro "Todos" de colar.
  const anoInicializado = useRef(false);

  useEffect(() => {
    const dimensao = filters.dimensao ?? "ocorrencia";
    Promise.all([fetchSimAnos(dimensao), fetchSimTipos(dimensao)])
      .then(([years, vehicleTypes]) => {
        setAnos(years.anos);
        setTipos(vehicleTypes.tipos);
        if (!anoInicializado.current && years.anos.length) {
          anoInicializado.current = true;
          setFilters((current) => ({ ...current, ano: years.anos.at(-1) }));
        }
      })
      .catch(() => setError("Nao foi possivel carregar os filtros do SIM."));
  }, [filters.dimensao]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchSimSummary(filters), fetchSimMunicipios(filters, 1, 200)])
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
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    fetchSimPopulacaoCobertura({
      dimensao: filters.dimensao,
      uf: filters.uf,
      regiao: filters.regiao,
    })
      .then(setPopCobertura)
      .catch(() => setPopCobertura(null));
  }, [filters.dimensao, filters.uf, filters.regiao]);

  const handleChange = (key: string, value: string) => {
    setFilters((current) => {
      const next = { ...current };
      if (key === "dimensao") next.dimensao = value === "residencia" ? "residencia" : "ocorrencia";
      if (key === "ano") next.ano = value ? Number(value) : undefined;
      if (key === "uf") {
        next.uf = value || undefined;
        next.regiao = undefined;
      }
      if (key === "regiao") {
        next.regiao = value || undefined;
        next.uf = undefined;
      }
      if (key === "tipo_veiculo") next.tipo_veiculo = value || undefined;
      return next;
    });
  };

  const topMunicipios = useMemo(() => municipios.slice(0, 10), [municipios]);
  const veiculoLegend = useMemo(
    () =>
      (data?.obitos_por_tipo_veiculo ?? []).map((row, index) => ({
        name: row.tipo_veiculo,
        color: PIE_COLORS[index % PIE_COLORS.length],
      })),
    [data?.obitos_por_tipo_veiculo],
  );
  const sexoLegend = useMemo(
    () =>
      (data?.obitos_por_sexo ?? []).map((row, index) => ({
        name: row.sexo,
        color: SEXO_COLORS[row.sexo] ?? PIE_COLORS[index % PIE_COLORS.length],
      })),
    [data?.obitos_por_sexo],
  );

  const filterDefs = [
    {
      key: "dimensao",
      label: "Dimensao",
      options: [
        { value: "ocorrencia", label: "Ocorrencia" },
        { value: "residencia", label: "Residencia" },
      ],
    },
    {
      key: "regiao",
      label: "Regiao",
      options: REGIOES.map((value) => ({ value, label: value })),
      placeholder: "Todas",
    },
    { key: "uf", label: "UF", options: ufs.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "ano", label: "Ano", options: anos.map((value) => ({ value: String(value), label: String(value) })) },
    {
      key: "tipo_veiculo",
      label: "Veiculo",
      options: tipos.map((value) => ({ value, label: value })),
      placeholder: "Todos",
    },
  ];

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
        Carregando dados do SIM...
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--danger)" }}>
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Painel SIM
          </h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Mortalidade por acidentes de transporte terrestre - {data.periodo}
          </p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters as Record<string, string>}
          onChange={handleChange}
          onReset={() => setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat rotulo="Obitos ATT" valor={formatNumber(data.total_obitos)} denominador={data.dimensao} />
        <KpiStat rotulo="Municipios" valor={formatNumber(data.municipios)} denominador="com registro" />
        <KpiStat rotulo="Fonte" valor="SIM" denominador="DATASUS" />
        <KpiStat rotulo="Geografia" valor={data.dimensao} denominador="papel analitico" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolucao mensal" subtitle="Variacao mensal de obitos no recorte filtrado">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.obitos_por_mes}>
              <defs>
                <linearGradient id="gObitosMes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--deaths)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--deaths)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="competencia"
                tick={{ fontSize: 10, fill: "var(--chart-text)" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--deaths)"
                fill="url(#gObitosMes)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolucao anual" subtitle="Obitos com causa V01-V89 e QA aprovado">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.obitos_por_ano}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Line type="monotone" dataKey="total" stroke="var(--deaths)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Obitos por Tipo de Veiculo">
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
                {data.obitos_por_tipo_veiculo.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
            </PieChart>
          </ResponsiveContainer>
          <SemanticLegend items={veiculoLegend} />
        </ChartCard>

        <ChartCard title="Obitos por Faixa Etaria">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <YAxis
                dataKey="faixa_etaria"
                type="category"
                tick={{ fontSize: 11, fill: "var(--chart-text)" }}
                width={45}
              />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.obitos_por_faixa_etaria.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuicao por Sexo">
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
                {data.obitos_por_sexo.map((row, index) => (
                  <Cell key={index} fill={SEXO_COLORS[row.sexo] ?? PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
            </PieChart>
          </ResponsiveContainer>
          <SemanticLegend items={sexoLegend} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 Municipios - Obitos" subtitle="Ordenacao pelo filtro atual">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topMunicipios} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
              <YAxis
                type="category"
                dataKey="municipio"
                width={110}
                tick={{ fontSize: 10, fill: "var(--chart-text)" }}
              />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Bar dataKey="obitos" fill="var(--deaths)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        className="rounded-xl p-4 text-xs"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          color: "var(--fg-secondary)",
        }}
      >
        {popCobertura && popCobertura.total_municipio_ano > 0 ? (
          <span className="inline-flex items-center gap-1">
            Cobertura populacional do recorte: {formatNumber(popCobertura.exata)} de{" "}
            {formatNumber(popCobertura.total_municipio_ano)} municipio-ano ({((popCobertura.exata / popCobertura.total_municipio_ano) * 100).toFixed(0)}%) com populacao exata
            (mesmo municipio e ano no IBGE); {formatNumber(popCobertura.estimada)}
            {" "}({((popCobertura.estimada / popCobertura.total_municipio_ano) * 100).toFixed(0)}%) usam a
            populacao do ano IBGE mais proximo
            <AlertTriangle className="mx-0.5 inline h-3 w-3" style={{ color: "var(--warning)" }} />
            e {formatNumber(popCobertura.indisponivel)} nao tem denominador disponivel (N/D). Frota SENATRAN
            permanece {data.denominadores.frota}.
          </span>
        ) : (
          <>
            Populacao usa o ano exato quando disponivel ou o ano IBGE mais proximo do mesmo municipio, com
            marcacao visual nas taxas estimadas. Frota SENATRAN permanece {data.denominadores.frota}.
          </>
        )}
      </div>
    </div>
  );
}
