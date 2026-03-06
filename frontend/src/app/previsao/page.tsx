"use client";

import { useCallback, useEffect, useState } from "react";

import ChartCard from "@/components/charts/ChartCard";
import ForecastChart from "@/components/charts/ForecastChart";
import KpiCard from "@/components/charts/KpiCard";
import { fetchMunicipios } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Municipio } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ForecastPoint {
  competencia: string;
  valor: number;
  lower: number;
  upper: number;
}

interface ForecastResponse {
  cod_mun_ibge: string;
  municipio: string;
  metrica: string;
  horizon: number;
  historico_meses: number;
  historico: { competencia: string; valor: number }[];
  previsao: ForecastPoint[];
}

export default function PrevisaoPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [selectedMun, setSelectedMun] = useState("");
  const [metrica, setMetrica] = useState<"obitos" | "custos">("obitos");
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMunicipios().then((m) => {
      setMunicipios(m.municipios);
      if (m.municipios.length > 0) {
        setSelectedMun(m.municipios[0].cod_mun_ibge);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedMun) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `${API_URL}/api/predict/${metrica}/${selectedMun}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Erro ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [selectedMun, metrica]);

  useEffect(() => {
    load();
  }, [load]);

  const munLabel =
    municipios.find((m) => m.cod_mun_ibge === selectedMun)?.municipio ??
    selectedMun;

  const lastPred = data?.previsao[data.previsao.length - 1];
  const firstPred = data?.previsao[0];
  const lastHist = data?.historico[data.historico.length - 1];

  return (
    <div className="space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Previsão IA — TimesFM
          </h1>
          <p className="text-xs text-slate-400">
            Modelo de fundação Google Research · Previsão de 12 meses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMun}
            onChange={(e) => setSelectedMun(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {municipios.map((m) => (
              <option key={m.cod_mun_ibge} value={m.cod_mun_ibge}>
                {m.municipio} ({m.uf})
              </option>
            ))}
          </select>
          <select
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as "obitos" | "custos")}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="obitos">Óbitos</option>
            <option value="custos">Custos (R$)</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {loading ? "Calculando..." : "Prever"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Carregando modelo TimesFM e executando previsão...</p>
            <p className="mt-1 text-xs text-slate-400">O primeiro carregamento pode levar alguns minutos</p>
          </div>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              title="Histórico"
              value={`${data.historico_meses} meses`}
              subtitle="Dados reais (DATASUS)"
              icon={<ClockIcon />}
              color="blue"
            />
            <KpiCard
              title="Horizonte"
              value={`${data.horizon} meses`}
              subtitle="Previsão futura"
              icon={<TrendIcon />}
              color="emerald"
            />
            <KpiCard
              title={metrica === "obitos" ? "Último Real" : "Último Real"}
              value={
                lastHist
                  ? metrica === "custos"
                    ? formatCurrency(lastHist.valor)
                    : formatNumber(lastHist.valor)
                  : "—"
              }
              subtitle={lastHist?.competencia ?? ""}
              icon={<ChartIcon />}
              color="amber"
            />
            <KpiCard
              title="Previsão Final"
              value={
                lastPred
                  ? metrica === "custos"
                    ? formatCurrency(lastPred.valor)
                    : formatNumber(lastPred.valor)
                  : "—"
              }
              subtitle={lastPred?.competencia ?? ""}
              icon={<SparkleIcon />}
              color="red"
            />
          </div>

          {/* Chart */}
          <ChartCard
            title={`${metrica === "obitos" ? "Óbitos" : "Custos Ambulatoriais"} — ${munLabel}`}
            subtitle={`Série histórica + previsão TimesFM (${data.historico_meses} meses → +${data.horizon})`}
          >
            <ForecastChart
              historico={data.historico}
              previsao={data.previsao}
              metrica={metrica}
              height={400}
            />
          </ChartCard>

          {/* Forecast table */}
          <ChartCard title="Detalhamento da Previsão" subtitle="Próximos 12 meses com intervalo de confiança">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Mês</th>
                    <th className="px-3 py-2 font-medium text-right">Previsão</th>
                    <th className="px-3 py-2 font-medium text-right">P10 (otimista)</th>
                    <th className="px-3 py-2 font-medium text-right">P90 (pessimista)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.previsao.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">{p.competencia}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {metrica === "custos" ? formatCurrency(p.valor) : formatNumber(p.valor)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {metrica === "custos" ? formatCurrency(p.lower) : formatNumber(p.lower)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {metrica === "custos" ? formatCurrency(p.upper) : formatNumber(p.upper)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}
