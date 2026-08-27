"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Building2, Gauge } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimPrelimCompletude,
  fetchSimPrelimMunicipios,
  fetchSimPrelimSummary,
  fetchSimSummary,
} from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type {
  SimPrelimCompletude,
  SimPrelimMunicipio,
  SimPrelimSummary,
} from "@/lib/types";

const PRELIM_ANOS = [2025, 2026];

function pct(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return `${(value * 100).toFixed(0)}%`;
}

/** Faixa de aviso PERSISTENTE — nunca um toast, sempre visivel no topo da tela. */
function FaixaAvisoPreliminar({ texto, dataExtracao }: { texto: string; dataExtracao: string | null }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={{
        backgroundColor: "var(--warning-soft)",
        border: "1px solid var(--warning)",
        color: "var(--fg)",
      }}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--warning)" }} />
      <div>
        <p className="font-semibold" style={{ color: "var(--warning)" }}>
          Dados preliminares — sujeitos a revisao
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--fg-secondary)" }}>
          {texto}
          {dataExtracao ? ` Extraido do DATASUS em ${dataExtracao}.` : ""}
        </p>
      </div>
    </div>
  );
}

export default function PreliminaresPage() {
  const [dimensao, setDimensao] = useState<"ocorrencia" | "residencia">("ocorrencia");
  const [uf, setUf] = useState<string | undefined>(undefined);
  const [ano, setAno] = useState<number>(PRELIM_ANOS[0]);
  const [ufs, setUfs] = useState<string[]>([]);

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
        <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
          Dados preliminares do SIM
        </h1>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
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
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-secondary)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--fg-muted)" }} />
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
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
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

      {loading && (
        <div className="flex h-16 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Carregando dados preliminares...
        </div>
      )}

      {indisponivel && !loading && (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
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
          style={{ backgroundColor: "var(--deaths-soft)", color: "var(--deaths)", border: "1px solid var(--deaths)" }}
        >
          {erro}
        </div>
      )}

      {summary && !loading && !indisponivel && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Obitos preliminares ⚠"
              value={formatNumber(summary.total_obitos)}
              subtitle={`${ano} · ${uf ?? "Brasil"} · dado preliminar, sujeito a revisao`}
              icon={<AlertTriangle className="h-5 w-5" />}
              semantic="deaths"
            />
            <KpiCard
              title="Municipios com registro"
              value={formatNumber(summary.municipios)}
              subtitle="preliminar, sujeito a revisao"
              icon={<Building2 className="h-5 w-5" />}
              semantic="success"
            />
            <KpiCard
              title="Completude media estimada"
              value={pct(summary.aviso_preliminar.completude_estimada)}
              subtitle="sinal de maturidade, nao fator de correcao"
              icon={<Gauge className="h-5 w-5" />}
              semantic="health"
            />
          </div>

          <ChartCard
            title="Padrao mensal — consolidado (2024) x preliminar"
            subtitle="Trecho preliminar em linha tracejada; series desenhadas lado a lado por mes-do-ano, nunca somadas"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <Tooltip
                  formatter={(value, name) => [
                    value == null ? "N/D" : formatNumber(Number(value)),
                    name === "consolidado_2024" ? "Consolidado 2024" : `Preliminar ${ano}`,
                  ]}
                  labelFormatter={(mes) => `Mes ${mes}`}
                />
                <Legend
                  formatter={(value) => (value === "consolidado_2024" ? "Consolidado 2024" : `Preliminar ${ano}`)}
                />
                <Line
                  type="monotone"
                  dataKey="consolidado_2024"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="consolidado_2024"
                />
                <Line
                  type="monotone"
                  dataKey="preliminar"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls
                  name="preliminar"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {completude && (
            <ChartCard
              title="Completude por mes"
              subtitle="obitos_preliminares(mes) / media(obitos_consolidados do mesmo mes nos ate 3 anos anteriores) — sinal, nao correcao"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Mes", "Obitos preliminares", "Media consolidada", "Completude"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--fg-muted)" }}
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
                          {linha.media_consolidado == null ? "N/D" : linha.media_consolidado.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}
                          >
                            {pct(linha.completude_estimada)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px]" style={{ color: "var(--fg-muted)" }}>
                {completude.notas_metodologicas}
              </p>
            </ChartCard>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Municipios — dados preliminares
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
                    {["Municipio", "UF", "Obitos", "Extraido em"].map((h) => (
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
                  {municipios.map((m) => (
                    <tr key={m.cod_mun_ibge} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--fg)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          {m.municipio}
                          <AlertTriangle className="h-3 w-3" style={{ color: "var(--warning)" }} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--fg-secondary)" }}>{m.uf}</td>
                      <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--fg)" }}>
                        {formatNumber(m.obitos)}
                      </td>
                      <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        {m.data_extracao ?? "N/D"}
                      </td>
                    </tr>
                  ))}
                  {municipios.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
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
