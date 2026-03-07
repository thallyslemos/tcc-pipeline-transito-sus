"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, TrendingUp, BarChart3, Sparkles, BrainCircuit } from "lucide-react";

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
      if (m.municipios.length > 0) setSelectedMun(m.municipios[0].cod_mun_ibge);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedMun) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_URL}/api/predict/${metrica}/${selectedMun}`, { cache: "no-store" });
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

  useEffect(() => { load(); }, [load]);

  const munLabel = municipios.find((m) => m.cod_mun_ibge === selectedMun)?.municipio ?? selectedMun;
  const lastPred = data?.previsao[data.previsao.length - 1];
  const lastHist = data?.historico[data.historico.length - 1];
  const isCustos = metrica === "custos";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Previsão IA — TimesFM
          </h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Modelo de fundação Google Research · Previsão de 12 meses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedMun} onChange={(e) => setSelectedMun(e.target.value)}
            className="h-8 rounded-lg px-3 text-xs focus:outline-none focus:ring-2"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}>
            {municipios.map((m) => (
              <option key={m.cod_mun_ibge} value={m.cod_mun_ibge}>{m.municipio} ({m.uf})</option>
            ))}
          </select>
          <select value={metrica} onChange={(e) => setMetrica(e.target.value as "obitos" | "custos")}
            className="h-8 rounded-lg px-3 text-xs focus:outline-none focus:ring-2"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}>
            <option value="obitos">Óbitos</option>
            <option value="custos">Custos (R$)</option>
          </select>
          <button onClick={load} disabled={loading}
            className="h-8 rounded-lg px-4 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>
            {loading ? "Calculando..." : "Prever"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--deaths-soft)", border: "1px solid var(--deaths)", color: "var(--deaths)" }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
            <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>
              Carregando modelo TimesFM e executando previsão...
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>
              O primeiro carregamento pode levar alguns minutos
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Histórico" value={`${data.historico_meses} meses`}
              subtitle="Dados reais (DATASUS)" icon={<Clock className="h-4 w-4" />} semantic="health" />
            <KpiCard title="Horizonte" value={`${data.horizon} meses`}
              subtitle="Previsão futura" icon={<TrendingUp className="h-4 w-4" />} semantic="success" />
            <KpiCard title="Último Real"
              value={lastHist ? (isCustos ? formatCurrency(lastHist.valor) : formatNumber(lastHist.valor)) : "—"}
              subtitle={lastHist?.competencia ?? ""} icon={<BarChart3 className="h-4 w-4" />} semantic="costs" />
            <KpiCard title="Previsão Final"
              value={lastPred ? (isCustos ? formatCurrency(lastPred.valor) : formatNumber(lastPred.valor)) : "—"}
              subtitle={lastPred?.competencia ?? ""} icon={<Sparkles className="h-4 w-4" />} semantic="deaths" />
          </div>

          {/* AI Insight Card */}
          <div className="rounded-xl p-4"
            style={{ backgroundColor: "var(--primary-soft)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}>
                <BrainCircuit className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Insight da IA</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  Modelo TimesFM (Google Research, 200M parâmetros) aplicado a{" "}
                  <strong>{data.historico_meses} meses</strong> de dados históricos de {munLabel}.
                  A previsão projeta {data.horizon} meses com intervalo de confiança P10–P90.
                  {lastPred && lastHist && (
                    <>{" "}Valor projetado para {lastPred.competencia}:{" "}
                    <strong>{isCustos ? formatCurrency(lastPred.valor) : formatNumber(lastPred.valor)}</strong>
                    {" "}(intervalo: {isCustos ? formatCurrency(lastPred.lower) : formatNumber(lastPred.lower)}
                    {" "}– {isCustos ? formatCurrency(lastPred.upper) : formatNumber(lastPred.upper)}).</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <ChartCard
            title={`${isCustos ? "Custos Ambulatoriais" : "Óbitos"} — ${munLabel}`}
            subtitle={`Série histórica + previsão TimesFM (${data.historico_meses} meses → +${data.horizon})`}
          >
            <ForecastChart historico={data.historico} previsao={data.previsao} metrica={metrica} height={400} />
          </ChartCard>

          {/* Forecast table */}
          <ChartCard title="Detalhamento da Previsão" subtitle="Próximos 12 meses com intervalo de confiança">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--fg-muted)" }}>
                    <th className="px-3 py-2 text-left font-medium">Mês</th>
                    <th className="px-3 py-2 text-right font-medium">Previsão</th>
                    <th className="px-3 py-2 text-right font-medium">P10 (otimista)</th>
                    <th className="px-3 py-2 text-right font-medium">P90 (pessimista)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.previsao.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--fg)" }}>{p.competencia}</td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--fg)" }}>
                        {isCustos ? formatCurrency(p.valor) : formatNumber(p.valor)}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--success)" }}>
                        {isCustos ? formatCurrency(p.lower) : formatNumber(p.lower)}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--deaths)" }}>
                        {isCustos ? formatCurrency(p.upper) : formatNumber(p.upper)}
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
