"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import Lede from "@/components/ui/Lede";
import KpiStat from "@/components/ui/KpiStat";
import RankedBar from "@/components/ui/RankedBar";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimPopulacaoCobertura,
  fetchSimSummary,
  fetchSimTipos,
} from "@/lib/api";
import { formatNumber, formatPercentual, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import { lerRecorteDaUrl, serializarRecorte } from "@/lib/url/recorte";
import { baixarCsv } from "@/lib/exportar/csv";
import { exportarPng } from "@/lib/exportar/rasterizar";
import { nomeArquivoExportacao } from "@/lib/exportar/nomeArquivo";
import type { FilterValues, SimMunicipio, SimPopulacaoCobertura, SimSummary } from "@/lib/types";

const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

/**
 * Mapeia tipo_veiculo (ate 9 categorias vindas do backend, ver
 * data-pipeline/sim_prelim_gold.py) para a paleta categorica de tipo de
 * vitima (design/DESIGN_SYSTEM.md §3.3: so 5 tokens — 4 matizes + outros).
 * Categorias fora das 4 principais caem em --cat-outros; "a paleta nao se
 * estende".
 */
function corCategoriaVeiculo(tipoVeiculo: string): string {
  switch (tipoVeiculo) {
    case "Motociclista":
      return "var(--cat-moto)";
    case "Pedestre":
      return "var(--cat-pedestre)";
    case "Automovel":
      return "var(--cat-auto)";
    case "Ciclista":
      return "var(--cat-ciclista)";
    default:
      return "var(--cat-outros)";
  }
}

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


// useSearchParams() faz o Next.js exigir um boundary de Suspense na
// pre-renderizacao estatica (senao o build falha com "should be wrapped in
// a suspense boundary") — o componente de verdade fica em DashboardContent.
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando dados do SIM...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsIniciais = useSearchParams();
  // Le a URL SO na montagem (estado inicial do useState roda uma unica vez).
  // Depois disso o fluxo e so estado -> URL (useEffect abaixo) — nunca o
  // contrario, pra nao criar um loop de sincronizacao entre os dois.
  const [filters, setFilters] = useState<FilterValues>(() => ({
    dimensao: "ocorrencia",
    ...lerRecorteDaUrl(searchParamsIniciais),
  }));
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
          // So auto-seleciona se o ano nao veio de lugar nenhum ainda (nem da
          // URL na carga inicial, nem de uma escolha do usuario) — um link de
          // recorte compartilhado com ?ano=2020 nao pode virar 2024 sozinho.
          setFilters((current) => (current.ano == null ? { ...current, ano: years.anos.at(-1) } : current));
        }
      })
      .catch(() => setError("Nao foi possivel carregar os filtros do SIM."));
  }, [filters.dimensao]);

  // design/DESIGN_SYSTEM.md §5.6 — "link do recorte": a URL sempre reflete o
  // filtro atual, sem reload de pagina. So-escrita (nunca le a URL de volta
  // depois da montagem, ver useState acima) — evita loop de sincronizacao.
  useEffect(() => {
    const query = serializarRecorte(filters).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

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

  // Auditoria A1: o painel nao tinha nenhum KPI de taxa, so contagem e
  // metadado — contra o principio "taxa antes de contagem". A API devolve
  // taxa_obitos_100mil por MUNICIPIO (nao um agregado pronto pro recorte
  // inteiro), entao a taxa do recorte e a soma dos obitos sobre a soma da
  // populacao dos municipios com denominador disponivel (nao a media das
  // taxas municipais, que pesaria igual um municipio de 2 mil habitantes e
  // um de 2 milhoes).
  const agregadoTaxa = useMemo(() => {
    const comPopulacao = municipios.filter((m) => m.populacao != null && m.populacao > 0);
    const populacaoTotal = comPopulacao.reduce((soma, m) => soma + (m.populacao ?? 0), 0);
    const obitosComPopulacao = comPopulacao.reduce((soma, m) => soma + m.obitos, 0);
    const comFrota = municipios.filter((m) => m.frota_total != null && m.frota_total > 0);
    const frotaTotal = comFrota.reduce((soma, m) => soma + (m.frota_total ?? 0), 0);
    const obitosComFrota = comFrota.reduce((soma, m) => soma + m.obitos, 0);
    return {
      taxa100mil: populacaoTotal > 0 ? (obitosComPopulacao / populacaoTotal) * 100000 : null,
      municipiosSemPop: municipios.length - comPopulacao.length,
      taxa10milVeiculos: frotaTotal > 0 ? (obitosComFrota / frotaTotal) * 10000 : null,
      municipiosSemFrota: municipios.length - comFrota.length,
    };
  }, [municipios]);

  const chipsRecorte = useMemo(() => {
    const chips = [{ rotulo: "Dimensão", valor: filters.dimensao === "residencia" ? "Residência" : "Ocorrência" }];
    if (filters.uf) chips.push({ rotulo: "UF", valor: filters.uf });
    if (filters.regiao) chips.push({ rotulo: "Região", valor: filters.regiao });
    chips.push({ rotulo: "Ano", valor: filters.ano ? String(filters.ano) : "Todos" });
    if (filters.tipo_veiculo) chips.push({ rotulo: "Veículo", valor: filters.tipo_veiculo });
    return chips;
  }, [filters]);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
  };

  // design/DESIGN_SYSTEM.md §11 — CSV com numerador (obitos) e denominador
  // (populacao) em colunas separadas, pra taxa poder ser recalculada fora
  // do sistema. Exportado pelo botao "Exportar" da BarraDeRecorte (dado
  // tabular do recorte inteiro, nao de um grafico especifico).
  const exportarMunicipiosCsv = () => {
    baixarCsv(
      nomeArquivoExportacao(
        { uf: filters.uf, regiao: filters.regiao, anoInicio: filters.ano, dimensao: filters.dimensao },
        "csv"
      ),
      municipios.map((m) => ({
        municipio: m.municipio,
        uf: m.uf,
        obitos_numerador: m.obitos,
        populacao_denominador: m.populacao ?? "",
        taxa_100mil: m.taxa_obitos_100mil ?? "",
      }))
    );
  };

  // PNG @2x do grafico "Evolucao anual", com a moldura (titulo/nota/
  // proveniencia) rasterizada junto — demonstra a capacidade do §11;
  // GraficoMoldura nao ganhou um botao de exportar proprio nesta fase
  // (manteria o contrato do componente estavel), entao o gatilho fica
  // aqui, ao lado do grafico.
  const evolucaoAnualRef = useRef<HTMLDivElement>(null);
  const exportarEvolucaoAnualPng = () => {
    if (evolucaoAnualRef.current) {
      exportarPng(
        evolucaoAnualRef.current,
        nomeArquivoExportacao(
          { uf: filters.uf, regiao: filters.regiao, anoInicio: filters.ano, dimensao: filters.dimensao, medida: "evolucaoanual" },
          "png"
        )
      );
    }
  };

  const topMunicipios = useMemo(() => municipios.slice(0, 10), [municipios]);
  const itensVeiculo = useMemo(
    () => (data?.obitos_por_tipo_veiculo ?? []).map((row) => ({ nome: row.tipo_veiculo, valor: row.total })),
    [data?.obitos_por_tipo_veiculo],
  );
  const itensSexo = useMemo(
    () => (data?.obitos_por_sexo ?? []).map((row) => ({ nome: row.sexo, valor: row.total })),
    [data?.obitos_por_sexo],
  );

  // Camada 3 (design/DESIGN_SYSTEM.md §6.2): obitos_por_ano e uma CONTAGEM,
  // nao uma taxa — mesmo ajuste de sujeito/formatador ja usado em /temporal.
  const leituraPainel = useMemo(() => {
    if (!data) return null;
    return gerarLeitura({
      g1: { totalObitos: data.total_obitos },
      r1: {
        pontos: data.obitos_por_ano.map((p) => ({ periodo: String(p.ano), valor: p.total })),
        opcoes: { sujeito: "O total de óbitos", formatarValor: formatNumber },
      },
      r2: municipios.map((m) => ({ municipio: m.municipio, obitos: m.obitos })),
    });
  }, [data, municipios]);

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
      <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
        Carregando dados do SIM...
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--alert)" }}>
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
            Painel SIM
          </h1>
          <p className="text-xs" style={{ color: "var(--ink-2)" }}>
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

      <BarraDeRecorte
        chips={chipsRecorte}
        n={data.total_obitos}
        aoClicarLink={copiarLinkDoRecorte}
        aoClicarExportar={exportarMunicipiosCsv}
      />

      <Lede rotulo="Panorama do recorte" leitura={leituraPainel} />

      {/* Auditoria A1: "Fonte" e "Geografia" saem daqui — sao metadado, nao
          medida, e ja aparecem em outro lugar da tela (fonte no rodape do
          menu, dimensao no chip "Dimensao" da BarraDeRecorte acima); no
          lugar entram as duas taxas do recorte, que faltavam por completo. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat rotulo="Obitos ATT" valor={formatNumber(data.total_obitos)} denominador={data.dimensao} />
        <KpiStat rotulo="Municipios" valor={formatNumber(data.municipios)} denominador="com registro" />
        <KpiStat
          rotulo="Taxa / 100 mil"
          valor={agregadoTaxa.taxa100mil == null ? "N/D" : formatTaxa100k(agregadoTaxa.taxa100mil)}
          denominador={
            agregadoTaxa.municipiosSemPop > 0
              ? `Populacao IBGE do recorte (${agregadoTaxa.municipiosSemPop} municipio(s) sem denominador)`
              : "Populacao IBGE do recorte"
          }
          termoAjuda="taxa_100mil"
        />
        <KpiStat
          rotulo="Taxa / 10 mil veic."
          valor={agregadoTaxa.taxa10milVeiculos == null ? "N/D" : formatTaxa10k(agregadoTaxa.taxa10milVeiculos)}
          denominador={
            agregadoTaxa.taxa10milVeiculos == null
              ? "Frota SENATRAN indisponivel no recorte"
              : `Frota SENATRAN do recorte${agregadoTaxa.municipiosSemFrota > 0 ? ` (${agregadoTaxa.municipiosSemFrota} sem frota)` : ""}`
          }
          termoAjuda="taxa_10mil_veiculos"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoMoldura medidaId="serie_mensal_obitos">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.obitos_por_mes}>
              <defs>
                <linearGradient id="gObitosMes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--risk-5)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--risk-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="competencia"
                tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--risk-5)"
                fill="url(#gObitosMes)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </GraficoMoldura>

        <div>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              onClick={exportarEvolucaoAnualPng}
              className="text-[11px] underline"
              style={{ color: "var(--brand)" }}
            >
              Exportar PNG
            </button>
          </div>
          {/* ref no wrapper (nao dentro de GraficoMoldura): a moldura inteira
              — titulo, nota de metodo e leitura — vai junto na captura
              (§11: "uma figura exportada sem moldura nao e citavel"). */}
          <div ref={evolucaoAnualRef}>
            <GraficoMoldura medidaId="evolucao_anual_obitos" leitura={leituraPainel}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.obitos_por_ano}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                  <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
                  <Line type="monotone" dataKey="total" stroke="var(--risk-5)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </GraficoMoldura>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <GraficoMoldura medidaId="obitos_por_tipo_veiculo">
          <RankedBar itens={itensVeiculo} corPorItem={corCategoriaVeiculo} />
        </GraficoMoldura>

        <GraficoMoldura medidaId="obitos_por_faixa_etaria">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.obitos_por_faixa_etaria} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
              <YAxis
                dataKey="faixa_etaria"
                type="category"
                tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                width={45}
              />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="var(--risk-2)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </GraficoMoldura>

        <GraficoMoldura medidaId="distribuicao_por_sexo">
          <RankedBar itens={itensSexo} />
        </GraficoMoldura>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoMoldura medidaId="ranking_municipios_obitos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topMunicipios} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} />
              <YAxis
                type="category"
                dataKey="municipio"
                width={110}
                tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
              />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Bar dataKey="obitos" fill="var(--risk-5)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </GraficoMoldura>
      </div>

      {(() => {
        // Auditoria A5: com >5% dos pares municipio-ano do recorte usando
        // populacao aproximada (§7a), o aviso precisa ser um aviso de
        // verdade — cor de atencao, nao a mesma nota cinza do rodape comum
        // (em 2010, por exemplo, e 100% dos municipios da Bahia).
        const percEstimada =
          popCobertura && popCobertura.total_municipio_ano > 0
            ? popCobertura.estimada / popCobertura.total_municipio_ano
            : 0;
        const aproximado = percEstimada > 0.05;
        return (
          <div
            className="rounded-xl p-4 text-xs"
            style={{
              backgroundColor: aproximado ? "var(--attention-soft)" : "var(--surface)",
              border: `1px solid ${aproximado ? "var(--attention)" : "var(--border)"}`,
              color: "var(--ink-2)",
            }}
            role={aproximado ? "alert" : undefined}
          >
            {popCobertura && popCobertura.total_municipio_ano > 0 ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle
                  className="mr-0.5 inline h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--attention)" }}
                />
                {aproximado && (
                  <strong style={{ color: "var(--attention-ink)" }}>
                    {formatPercentual(percEstimada * 100)}% do recorte usa populacao aproximada —{" "}
                  </strong>
                )}
                Cobertura populacional do recorte: {formatNumber(popCobertura.exata)} de{" "}
                {formatNumber(popCobertura.total_municipio_ano)} municipio-ano ({formatPercentual((popCobertura.exata / popCobertura.total_municipio_ano) * 100)}%) com populacao exata
                (mesmo municipio e ano no IBGE); {formatNumber(popCobertura.estimada)}
                {" "}({formatPercentual(percEstimada * 100)}%) usam a populacao do ano IBGE mais proximo
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
        );
      })()}
    </div>
  );
}
