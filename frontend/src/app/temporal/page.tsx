"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GraficoMoldura from "@/components/ui/GraficoMoldura";
import Lede from "@/components/ui/Lede";
import KpiStat from "@/components/ui/KpiStat";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimTemporalDiaSemana,
  fetchSimTemporalOutliers,
  fetchSimTemporalSerieMensal,
  fetchSimTipos,
} from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import type { SimDiaSemana, SimOutliers, SimSerieMensal } from "@/lib/types";

const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

interface TemporalFilterState {
  dimensao: "ocorrencia" | "residencia";
  uf?: string;
  regiao?: string;
  ano?: number;
  tipo_veiculo?: string;
}

function pct(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

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

const CLASSE_LABEL: Record<string, string> = {
  evento_unico: "Evento unico",
  concentrado: "Concentrado",
  difuso: "Difuso",
};

const CLASSE_COLOR: Record<string, string> = {
  evento_unico: "var(--deaths)",
  concentrado: "#f59e0b",
  difuso: "var(--success)",
};

export default function TemporalPage() {
  const [filters, setFilters] = useState<TemporalFilterState>({ dimensao: "ocorrencia" });
  const [anos, setAnos] = useState<number[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);

  const [serieMensal, setSerieMensal] = useState<SimSerieMensal | null>(null);
  const [diaSemana, setDiaSemana] = useState<SimDiaSemana | null>(null);
  const [outliers, setOutliers] = useState<SimOutliers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSimAnos(filters.dimensao).then((r) => setAnos(r.anos));
    fetchSimTipos(filters.dimensao).then((r) => setTipos(r.tipos));
    // page_size maximo aceito pela API e 200 (acima disso o backend retorna
    // 422 e, sem .catch, o dropdown de UF ficava vazio silenciosamente).
    fetchSimMunicipios({ dimensao: filters.dimensao }, 1, 200)
      .then((r) => setUfs([...new Set(r.municipios.map((m) => m.uf))].sort()))
      .catch(() => setUfs([]));
  }, [filters.dimensao]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const base = {
      dimensao: filters.dimensao,
      uf: filters.uf,
      regiao: filters.regiao,
      ano: filters.ano,
      tipo_veiculo: filters.tipo_veiculo,
      ...(filters.ano ? {} : { ano_inicio: 2010, ano_fim: 2024 }),
    };
    Promise.all([
      fetchSimTemporalSerieMensal(base),
      fetchSimTemporalDiaSemana(base),
      fetchSimTemporalOutliers({ ...base, min_obitos: 5, somente_concentrados: true }),
    ])
      .then(([sm, ds, out]) => {
        if (cancelled) return;
        setSerieMensal(sm);
        setDiaSemana(ds);
        setOutliers(out);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar dados temporais");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const serieChartData = useMemo(
    () =>
      (serieMensal?.pontos ?? []).map((p) => ({
        competencia: p.competencia,
        obitos: p.obitos,
        pico: p.competencia === serieMensal?.resumo.mes_pico,
      })),
    [serieMensal]
  );

  const diaSemanaChartData = useMemo(
    () =>
      (diaSemana?.distribuicao ?? []).map((d) => ({
        nome: d.dia_semana_nome,
        media_por_dia: d.media_por_dia,
        fimDeSemana: d.dia_semana === 6 || d.dia_semana === 7,
      })),
    [diaSemana]
  );

  const mediaGeralDia = useMemo(() => {
    if (!diaSemana || diaSemana.total_obitos === 0) return 0;
    const totalDias = diaSemana.distribuicao.reduce((acc, d) => acc + d.dias_no_calendario, 0);
    return totalDias ? diaSemana.total_obitos / totalDias : 0;
  }, [diaSemana]);

  // Camada 3 (design/DESIGN_SYSTEM.md §6.2): a serie mensal e uma CONTAGEM,
  // nao uma taxa — R1 recebe sujeito/formatador proprios pra nao afirmar
  // "a taxa" sobre um numero que nao e taxa.
  const leituraSerieMensal = useMemo(() => {
    if (!serieMensal) return null;
    return gerarLeitura({
      g1: { totalObitos: serieMensal.resumo.total_obitos },
      r1: {
        pontos: serieMensal.pontos.map((p) => ({ periodo: p.competencia, valor: p.obitos })),
        opcoes: { sujeito: "O total de óbitos", formatarValor: formatNumber },
      },
    });
  }, [serieMensal]);

  const proveniencia = `SIM/DATASUS · dimensão ${filters.dimensao}${filters.uf ? ` · UF ${filters.uf}` : ""}${
    filters.ano ? ` · ano ${filters.ano}` : " · 2010-2024"
  }`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
          Analise Temporal
        </h1>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Serie mensal, distribuicao por dia da semana e concentracao temporal (casos de evento unico)
        </p>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-4 rounded-xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Dimensao
          </span>
          <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
            {(["ocorrencia", "residencia"] as const).map((dim) => (
              <button
                key={dim}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, dimensao: dim }))}
                className="px-3 py-2 text-xs font-medium capitalize transition-colors"
                style={{
                  backgroundColor: filters.dimensao === dim ? "var(--primary)" : "var(--bg-card)",
                  color: filters.dimensao === dim ? "var(--primary-fg)" : "var(--fg-secondary)",
                }}
              >
                {dim}
              </button>
            ))}
          </div>
        </div>

        <FilterBar
          filters={[
            { key: "uf", label: "UF", options: ufs.map((v) => ({ value: v, label: v })), placeholder: "Todas" },
            {
              key: "regiao",
              label: "Regiao",
              options: REGIOES.map((v) => ({ value: v, label: v })),
              placeholder: "Todas",
            },
            {
              key: "ano",
              label: "Ano",
              options: anos.map((a) => ({ value: String(a), label: String(a) })),
              placeholder: "2010-2024 (completo)",
            },
            {
              key: "tipo_veiculo",
              label: "Veiculo",
              options: tipos.map((v) => ({ value: v, label: v })),
              placeholder: "Todos",
            },
          ]}
          values={{
            uf: filters.uf ?? "",
            regiao: filters.regiao ?? "",
            ano: filters.ano ? String(filters.ano) : "",
            tipo_veiculo: filters.tipo_veiculo ?? "",
          }}
          onChange={(key, value) =>
            setFilters((f) => ({
              ...f,
              [key]: key === "ano" ? (value ? Number(value) : undefined) : value || undefined,
            }))
          }
          onReset={() => setFilters({ dimensao: filters.dimensao })}
        />
      </div>

      {loading && (
        <div className="flex h-16 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Carregando dados temporais...
        </div>
      )}
      {error && !loading && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--deaths-soft)", color: "var(--deaths)", border: "1px solid var(--deaths)" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && serieMensal && diaSemana && (
        <>
          <Lede rotulo="Panorama do recorte" leitura={leituraSerieMensal} />

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiStat
              rotulo="Media mensal"
              valor={serieMensal.resumo.media_mensal != null ? formatNumber(Math.round(serieMensal.resumo.media_mensal)) : "-"}
              denominador={`${serieMensal.resumo.meses_com_obito} meses com registro`}
            />
            <KpiStat
              rotulo="Mes de pico"
              valor={serieMensal.resumo.mes_pico ?? "-"}
              denominador={`${pct(serieMensal.resumo.share_mes_pico)} do total no mes de pico`}
            />
            <KpiStat
              rotulo="Razao fim de semana / dia util"
              valor={diaSemana.razao_fim_semana != null ? diaSemana.razao_fim_semana.toFixed(2) : "-"}
              denominador={`${pct(diaSemana.fim_de_semana.proporcao_observada)} dos obitos no fim de semana`}
            />
            <KpiStat
              rotulo="Qui-quadrado (dia da semana)"
              valor={diaSemana.qui_quadrado.p_valor != null ? `p=${diaSemana.qui_quadrado.p_valor.toFixed(4)}` : "-"}
              denominador={
                diaSemana.qui_quadrado.significativo_005 === null
                  ? "sem dados suficientes"
                  : diaSemana.qui_quadrado.significativo_005
                    ? "significativo (p<0,05)"
                    : "nao significativo (p>=0,05)"
              }
            />
          </div>

          {/* Serie mensal */}
          <GraficoMoldura medidaId="serie_mensal_obitos" leitura={leituraSerieMensal} proveniencia={proveniencia}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={serieChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="competencia"
                  tick={{ fontSize: 9, fill: "var(--chart-text)" }}
                  interval={serieChartData.length > 24 ? Math.floor(serieChartData.length / 24) : 0}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <ThemedTooltip
                  formatter={(value: number) => [formatNumber(value), "Obitos"]}
                />
                <Bar dataKey="obitos" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {serieChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.pico ? "var(--deaths)" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GraficoMoldura>

          {/* Dia da semana */}
          <GraficoMoldura
            medidaId="distribuicao_dia_semana"
            termoAjuda="distribuicao_dia_semana"
            proveniencia={proveniencia}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={diaSemanaChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <ThemedTooltip formatter={(value: number) => [value.toFixed(3), "Media por dia"]} />
                <ReferenceLine
                  y={mediaGeralDia}
                  stroke="var(--fg-muted)"
                  strokeDasharray="4 4"
                  label={{ value: "media geral", fontSize: 10, fill: "var(--fg-muted)", position: "insideTopRight" }}
                />
                <Bar dataKey="media_por_dia" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {diaSemanaChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fimDeSemana ? "var(--deaths)" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GraficoMoldura>

          {/* Outliers */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Municipios com concentracao temporal (evento unico / concentrado)
              </h2>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                Taxas anuais dominadas por um unico dia ou mes nao descrevem risco viario habitual — ver caso Gaviao/2024
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
                    {["Municipio", "UF", "Ano", "Obitos", "Meses c/ obito", "% mes pico", "% dia pico", "Classe"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(outliers?.municipios ?? []).map((m) => (
                    <tr key={`${m.cod_mun_ibge}-${m.ano}`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--fg)" }}>{m.municipio}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--fg-secondary)" }}>{m.uf}</td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--fg-secondary)" }}>{m.ano}</td>
                      <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--fg)" }}>
                        {formatNumber(m.obitos_ano)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                        {m.meses_com_obito}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                        {pct(m.share_mes_pico)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                        {pct(m.share_dia_pico)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${CLASSE_COLOR[m.classe_concentracao]} 15%, transparent)`,
                            color: CLASSE_COLOR[m.classe_concentracao],
                          }}
                        >
                          {CLASSE_LABEL[m.classe_concentracao]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(outliers?.municipios.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
                        Nenhum municipio com concentracao temporal relevante no recorte selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {outliers && (
              <div
                className="px-4 py-2 text-[10px]"
                style={{ backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border)", color: "var(--fg-muted)" }}
              >
                {outliers.notas_metodologicas}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
