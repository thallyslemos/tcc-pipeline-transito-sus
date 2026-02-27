"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchAnosDisponiveis, fetchDashboardSummary } from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";

import ChartCard from "./ChartCard";
import KpiCard from "./KpiCard";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
];

interface DashboardData {
  total_obitos: number;
  total_custos: number;
  total_atendimentos: number;
  municipios: number;
  periodo: string;
  obitos_por_ano: { ano: number; total: number }[];
  custos_por_ano: { ano: number; total: number }[];
  obitos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  custos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  obitos_por_municipio: { municipio: string; total: number }[];
  custos_por_municipio: { municipio: string; total: number }[];
  serie_temporal_obitos: { competencia: string; valor: number }[];
  serie_temporal_custos: { competencia: string; valor: number }[];
  obitos_por_faixa_etaria: { faixa_etaria: string; total: number }[];
  obitos_por_sexo: { sexo: string; total: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnosDisponiveis()
      .then((res) => setAnos(res.anos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboardSummary(anoSelecionado)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [anoSelecionado]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-slate-500">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">Erro ao carregar dados</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Acidentes de Trânsito no SUS
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Impacto econômico e macrotendências — DATASUS (SIM + SIA)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="ano"
                className="text-sm font-medium text-slate-600"
              >
                Período:
              </label>
              <select
                id="ano"
                value={anoSelecionado ?? ""}
                onChange={(e) =>
                  setAnoSelecionado(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos (2019–2023)</option>
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Storytelling intro */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white shadow-lg">
          <h2 className="text-lg font-bold">
            📊 Panorama {data.periodo}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-blue-100">
            No período analisado, os acidentes de trânsito geraram{" "}
            <strong className="text-white">
              {formatNumber(data.total_obitos)} óbitos
            </strong>{" "}
            e custaram{" "}
            <strong className="text-white">
              {formatCurrency(data.total_custos)}
            </strong>{" "}
            ao SUS em{" "}
            <strong className="text-white">
              {formatNumber(data.total_atendimentos)} atendimentos
            </strong>{" "}
            ambulatoriais, nos {data.municipios} municípios analisados.
          </p>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total de Óbitos"
            value={formatNumber(data.total_obitos)}
            subtitle={data.periodo}
            icon={<SkullIcon />}
            color="red"
          />
          <KpiCard
            title="Custo Total SUS"
            value={formatCurrency(data.total_custos)}
            subtitle="Procedimentos ambulatoriais"
            icon={<CurrencyIcon />}
            color="amber"
          />
          <KpiCard
            title="Atendimentos"
            value={formatNumber(data.total_atendimentos)}
            subtitle="Registros SIA/SUS"
            icon={<HospitalIcon />}
            color="blue"
          />
          <KpiCard
            title="Municípios"
            value={String(data.municipios)}
            subtitle="SP, BH, Vitória da Conquista"
            icon={<MapIcon />}
            color="emerald"
          />
        </div>

        {/* Row 1: Trends */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Evolução de Óbitos"
            subtitle="Série mensal — todos os municípios"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.serie_temporal_obitos}>
                <defs>
                  <linearGradient
                    id="gradObitos"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="competencia"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "Óbitos"]}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#gradObitos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Evolução de Custos (R$)"
            subtitle="Série mensal — procedimentos ambulatoriais"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.serie_temporal_custos}>
                <defs>
                  <linearGradient
                    id="gradCustos"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="competencia"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompact(v)}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), "Custo"]}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#gradCustos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Row 2: Breakdowns */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            title="Óbitos por Tipo de Veículo"
            subtitle="Distribuição percentual"
          >
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.obitos_por_tipo_veiculo}
                  dataKey="total"
                  nameKey="tipo_veiculo"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={45}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.obitos_por_tipo_veiculo.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "Óbitos"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Óbitos por Faixa Etária"
            subtitle="Perfil demográfico das vítimas"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="faixa_etaria"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={48}
                />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "Óbitos"]}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {data.obitos_por_faixa_etaria.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Óbitos por Município"
            subtitle="Comparativo entre cidades"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.obitos_por_municipio}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="municipio"
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "Óbitos"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {data.obitos_por_municipio.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Row 3: Yearly comparison */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Custos por Município"
            subtitle="Impacto financeiro ao SUS por cidade"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.custos_por_municipio}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="municipio" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompact(v)}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), "Custo"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {data.custos_por_municipio.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Evolução Anual"
            subtitle="Óbitos e custos por ano"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.obitos_por_ano}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "Óbitos"]}
                />
                <Legend />
                <Bar
                  dataKey="total"
                  name="Óbitos"
                  fill="#ef4444"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Footer storytelling */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-800">
            💡 Principais Achados
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>
              • <strong>Motociclistas</strong> representam a maior proporção de
              óbitos (~35%), seguidos por ocupantes de automóveis (~28%).
            </li>
            <li>
              • A faixa etária <strong>25-34 anos</strong> concentra o maior
              número de vítimas fatais, indicando impacto na população
              economicamente ativa.
            </li>
            <li>
              • Em <strong>2020</strong>, houve queda significativa nos registros
              (efeito pandemia COVID-19), com retomada progressiva nos anos
              seguintes.
            </li>
            <li>
              • Os custos ao SUS acompanham a tendência dos óbitos, com
              correlação direta entre volume de atendimentos e impacto
              financeiro.
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            Fonte: Dados amostrais simulados com base nos padrões do DATASUS
            (SIM/SIA). TCC — Sistemas de Informação, IFBA.
          </p>
        </div>
      </main>
    </div>
  );
}

function SkullIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function HospitalIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
    </svg>
  );
}
