"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

import GraficoMoldura from "@/components/ui/GraficoMoldura";
import KpiStat from "@/components/ui/KpiStat";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimPrelimCompletude,
  fetchSimPrelimMunicipios,
  fetchSimPrelimSummary,
  fetchSimSummary,
} from "@/lib/api";
import { formatNumber, formatPercentual } from "@/lib/format";
import { lerRecorteDaUrl, serializarRecorte } from "@/lib/url/recorte";
import type {
  SimPrelimCompletude,
  SimPrelimMunicipio,
  SimPrelimSummary,
} from "@/lib/types";

const PRELIM_ANOS = [2025, 2026];

// design/DESIGN_SYSTEM.md §2: "percentual com uma casa", pt-BR (virgula) —
// auditoria A2.
function pct(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return `${formatPercentual(value * 100)}%`;
}

// design/DESIGN_SYSTEM.md §9: legenda sempre em DOM, nunca <Legend/> nativo
// do Recharts (auditoria B3/M6 — este grafico ainda usava o nativo).
function ThemedTooltip(props: Record<string, unknown>) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--ink)",
        boxShadow: "var(--shadow-pop)",
      }}
      itemStyle={{ color: "var(--ink)" }}
      labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
    />
  );
}

function LegendaLinha({ cor, tracejado, rotulo }: { cor: string; tracejado?: boolean; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0 w-4"
        style={{ borderTop: `2px ${tracejado ? "dashed" : "solid"} ${cor}` }}
      />
      <span style={{ color: "var(--ink-2)" }}>{rotulo}</span>
    </span>
  );
}

/** Faixa de aviso PERSISTENTE — nunca um toast, sempre visivel no topo da tela. */
function FaixaAvisoPreliminar({ texto, dataExtracao }: { texto: string; dataExtracao: string | null }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={{
        backgroundColor: "var(--attention-soft)",
        border: "1px solid var(--attention)",
        color: "var(--ink)",
      }}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--attention)" }} />
      <div>
        <p className="font-semibold" style={{ color: "var(--attention)" }}>
          Dados preliminares — sujeitos a revisao
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ink-2)" }}>
          {texto}
          {dataExtracao ? ` Extraido do DATASUS em ${dataExtracao}.` : ""}
        </p>
      </div>
    </div>
  );
}

// useSearchParams() exige boundary de Suspense na pre-renderizacao estatica
// do App Router (ver dashboard/page.tsx).
export default function PreliminaresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando...
        </div>
      }
    >
      <PreliminaresContent />
    </Suspense>
  );
}

function PreliminaresContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsIniciais = useSearchParams();
  const recorteUrl = lerRecorteDaUrl(searchParamsIniciais);
  const [dimensao, setDimensao] = useState<"ocorrencia" | "residencia">(() => recorteUrl.dimensao ?? "ocorrencia");
  const [uf, setUf] = useState<string | undefined>(() => recorteUrl.uf);
  const [ano, setAno] = useState<number>(() => recorteUrl.ano ?? PRELIM_ANOS[0]);
  const [ufs, setUfs] = useState<string[]>([]);

  // Estado -> URL, so-escrita (ver dashboard/page.tsx).
  useEffect(() => {
    const query = serializarRecorte({ dimensao, uf, ano }).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [dimensao, uf, ano, pathname, router]);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
  };

  const [summary, setSummary] = useState<SimPrelimSummary | null>(null);
  const [consolidadoPorMes, setConsolidadoPorMes] = useState<{ competencia: string; total: number }[]>([]);
  const [municipios, setMunicipios] = useState<SimPrelimMunicipio[]>([]);
  const [completude, setCompletude] = useState<SimPrelimCompletude | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const ufsInicializado = useRef(false);
  useEffect(() => {
    fetchSimMunicipios({ dimensao }, 1, 200).then((r) => {
      if (!ufsInicializado.current) {
        ufsInicializado.current = true;
      }
      setUfs([...new Set(r.municipios.map((m) => m.uf))].sort());
    });
  }, [dimensao]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    setIndisponivel(false);

    Promise.all([
      fetchSimPrelimSummary({ dimensao, uf, ano }),
      fetchSimPrelimMunicipios({ dimensao, uf, ano }, 1, 50),
      fetchSimPrelimCompletude({ dimensao, uf, ano }),
      // Consolidado usado SOMENTE para desenhar o trecho solido do grafico
      // combinado (nunca para comparar/agregar com o preliminar). O ultimo
      // ano consolidado (2024) e o ponto de referencia visual do "antes".
      fetchSimSummary({ dimensao, uf, ano: 2024 }),
    ])
      .then(([s, m, c, consolidado]) => {
        if (cancelled) return;
        setSummary(s);
        setMunicipios(m.municipios);
        setCompletude(c);
        setConsolidadoPorMes(consolidado.obitos_por_mes);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.message.includes("503")) {
          setIndisponivel(true);
        } else {
          setErro(err instanceof Error ? err.message : "Erro ao carregar dados preliminares");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dimensao, uf, ano]);

  // Grafico combinado: consolidado (2024, linha solida) + preliminar (linha
  // tracejada) no mesmo eixo de mes-do-ano, para mostrar o padrao sazonal
  // lado a lado sem fundir os dois em uma unica serie/soma.
  const chartData = useMemo(() => {
    const porMesConsolidado = new Map<string, number>();
    for (const p of consolidadoPorMes) {
      const mes = p.competencia.slice(5, 7);
      porMesConsolidado.set(mes, p.total);
    }
    const porMesPrelim = new Map<string, number>();
    for (const p of summary?.obitos_por_mes ?? []) {
      const mes = p.competencia.slice(5, 7);
      porMesPrelim.set(mes, p.total);
    }
    const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    return meses.map((mes) => ({
      mes,
      consolidado_2024: porMesConsolidado.get(mes) ?? null,
      preliminar: porMesPrelim.get(mes) ?? null,
    }));
  }, [consolidadoPorMes, summary]);

  const filterDefs = [
    {
      key: "uf",
      label: "UF",
      options: ufs.map((v) => ({ value: v, label: v })),
      placeholder: "Todas",
    },
    {
      key: "ano",
      label: "Ano preliminar",
      options: PRELIM_ANOS.map((a) => ({ value: String(a), label: String(a) })),
    },
    {
      key: "dimensao",
      label: "Dimensao",
      options: [
        { value: "ocorrencia", label: "Ocorrencia" },
        { value: "residencia", label: "Residencia" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          Dados preliminares do SIM
        </h1>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          Camada complementar (PRELIM/DORES) — captacao ainda em andamento, isolada da serie consolidada.
        </p>
      </div>

      <FaixaAvisoPreliminar
        texto={
          summary?.aviso_preliminar.texto ??
          "Dados preliminares do SIM, sujeitos a revisao e ainda em captacao. Nao comparaveis com anos consolidados."
        }
        dataExtracao={summary?.aviso_preliminar.data_extracao ?? null}
      />

      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-2)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ink-2)" }} />
        <p>
          <b>Comparacao direta com anos consolidados esta desabilitada nesta tela.</b> Dados preliminares nao
          sao apenas &ldquo;nao revisados&rdquo; — sao incompletos: a base cresce por meses apos o fim do ano.
          Comparar {ano} preliminar com 2024 consolidado produziria uma queda falsa que mede completude da
          captacao, nao mortalidade. Use o indicador de completude abaixo para avaliar a maturidade da base, e
          o <a href="/dashboard" className="underline">Painel Geral</a> para as taxas consolidadas.
        </p>
      </div>

      <div
        className="flex flex-wrap items-end gap-4 rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <FilterBar
          filters={filterDefs}
          values={{ uf: uf ?? "", ano: String(ano), dimensao }}
          onChange={(key, value) => {
            if (key === "uf") setUf(value || undefined);
            if (key === "ano") setAno(value ? Number(value) : PRELIM_ANOS[0]);
            if (key === "dimensao") setDimensao(value === "residencia" ? "residencia" : "ocorrencia");
          }}
        />
      </div>

      <BarraDeRecorte
        chips={[
          { rotulo: "Dimensão", valor: dimensao === "residencia" ? "Residência" : "Ocorrência" },
          ...(uf ? [{ rotulo: "UF", valor: uf }] : []),
          { rotulo: "Ano", valor: String(ano) },
        ]}
        n={summary?.total_obitos ?? 0}
        aoClicarLink={copiarLinkDoRecorte}
      />

      {loading && (
        <div className="flex h-16 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando dados preliminares...
        </div>
      )}

      {indisponivel && !loading && (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-2)" }}
        >
          Nenhum dado preliminar foi ingerido ainda neste ambiente. Rode{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">
            uv run python -m data-pipeline.run --prelim --ufs {uf ?? "BA"} --prelim-anos {ano}
          </code>{" "}
          para popular esta tela.
        </div>
      )}

      {erro && !loading && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--risk-1)", color: "var(--risk-5)", border: "1px solid var(--risk-5)" }}
        >
          {erro}
        </div>
      )}

      {summary && !loading && !indisponivel && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiStat
              rotulo="Obitos preliminares ⚠"
              valor={formatNumber(summary.total_obitos)}
              denominador={`${ano} · ${uf ?? "Brasil"} · dado preliminar, sujeito a revisao`}
            />
            <KpiStat
              rotulo="Municipios com registro"
              valor={formatNumber(summary.municipios)}
              denominador="preliminar, sujeito a revisao"
            />
            <KpiStat
              rotulo="Completude media estimada"
              valor={pct(summary.aviso_preliminar.completude_estimada)}
              denominador="sinal de maturidade, nao fator de correcao"
            />
          </div>

          <GraficoMoldura
            medidaId="padrao_mensal_consolidado_x_preliminar"
            legenda={
              <div className="flex flex-wrap gap-4 text-xs">
                <LegendaLinha cor="var(--risk-5)" rotulo="Consolidado 2024" />
                <LegendaLinha cor="var(--attention)" tracejado rotulo={`Preliminar ${ano} · cobertura parcial`} />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
                <ThemedTooltip
                  formatter={(value: number, name: string) => [
                    value == null ? "N/D" : formatNumber(Number(value)),
                    name === "consolidado_2024" ? "Consolidado 2024" : `Preliminar ${ano} · cobertura parcial`,
                  ]}
                  labelFormatter={(mes: number) => `Mes ${mes}`}
                />
                <Line
                  type="monotone"
                  dataKey="consolidado_2024"
                  stroke="var(--risk-5)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="consolidado_2024"
                  isAnimationActive={false}
                />
                {/* design/DESIGN_SYSTEM.md §7b: dado preliminar nunca no mesmo
                    eixo que o consolidado sem quebra visual — aqui a quebra e
                    o traco tracejado em --attention (a regua vertical de
                    inicio do periodo nao se aplica: este grafico justapoe as
                    duas series por mes-do-ano, nao por uma linha do tempo
                    continua). */}
                <Line
                  type="monotone"
                  dataKey="preliminar"
                  stroke="var(--attention)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls
                  name="preliminar"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </GraficoMoldura>

          {completude && (
            <GraficoMoldura medidaId="completude_por_mes">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Mes", "Obitos preliminares", "Media consolidada", "Completude"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--ink-2)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completude.por_mes.map((linha) => (
                      <tr key={`${linha.uf}-${linha.mes}`} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-3 py-2 tabular-nums">{String(linha.mes).padStart(2, "0")}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {linha.obitos_prelim == null ? "N/D" : formatNumber(linha.obitos_prelim)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {linha.media_consolidado == null
                            ? "N/D"
                            : linha.media_consolidado.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: "var(--attention-soft)", color: "var(--attention)" }}
                          >
                            {pct(linha.completude_estimada)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GraficoMoldura>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Municipios — dados preliminares
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
                    {["Municipio", "UF", "Obitos", "Extraido em"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {municipios.map((m) => (
                    <tr key={m.cod_mun_ibge} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          {m.municipio}
                          <AlertTriangle className="h-3 w-3" style={{ color: "var(--attention)" }} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--ink-2)" }}>{m.uf}</td>
                      <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--ink)" }}>
                        {formatNumber(m.obitos)}
                      </td>
                      <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--ink-2)" }}>
                        {m.data_extracao ?? "N/D"}
                      </td>
                    </tr>
                  ))}
                  {municipios.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: "var(--ink-2)" }}>
                        Nenhum municipio preliminar no recorte selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
