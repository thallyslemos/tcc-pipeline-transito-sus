"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import GraficoMoldura from "@/components/ui/GraficoMoldura";
import KpiStat from "@/components/ui/KpiStat";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import { fetchSimAnos, fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { formatNumber, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import { lerRecorteDaUrl, serializarRecorte } from "@/lib/url/recorte";
import PopulacaoBadge from "@/components/PopulacaoBadge";
import { taxaInstavel } from "@/content/qualidade";
import type { FilterValues, SimMunicipio, SimMunicipioDetail } from "@/lib/types";

// Auditoria M8: <Tooltip/> nativo sem tema cai nos defaults do Recharts
// (fundo branco fixo, texto preto rgb(0,0,0)) — quebra o tema escuro.
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

// useSearchParams() exige boundary de Suspense na pre-renderizacao estatica
// do App Router (ver dashboard/page.tsx).
export default function MunicipioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando...
        </div>
      }
    >
      <MunicipioContent />
    </Suspense>
  );
}

function MunicipioContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsIniciais = useSearchParams();
  const recorteUrl = lerRecorteDaUrl(searchParamsIniciais);
  const [dimensao, setDimensao] = useState<FilterValues["dimensao"]>(() => recorteUrl.dimensao ?? "ocorrencia");
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [cod, setCod] = useState(() => recorteUrl.municipio ?? "");
  const [ano, setAno] = useState<number | undefined>(() => recorteUrl.ano);
  const [detail, setDetail] = useState<SimMunicipioDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado -> URL, so-escrita (ver dashboard/page.tsx).
  useEffect(() => {
    const query = serializarRecorte({ dimensao, ano, municipio: cod }).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [dimensao, ano, cod, pathname, router]);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
  };

  // Camada 3 (design/DESIGN_SYSTEM.md §6.2): serie_mensal e uma CONTAGEM,
  // nao uma taxa — mesmo ajuste de sujeito/formatador ja usado em /temporal
  // e /dashboard.
  const leituraSerie = useMemo(() => {
    if (!detail) return null;
    return gerarLeitura({
      g1: { totalObitos: detail.total_obitos },
      r1: {
        pontos: detail.serie_mensal.map((p) => ({ periodo: p.competencia, valor: p.obitos })),
        opcoes: { sujeito: "O total de óbitos", formatarValor: formatNumber },
      },
    });
  }, [detail]);

  useEffect(() => {
    fetchSimAnos(dimensao).then((result) => {
      setAnos(result.anos);
      if (!ano && result.anos.length) setAno(result.anos.at(-1));
    });
    fetchSimMunicipios({ dimensao }, 1, 200).then((result) => {
      setMunicipios(result.municipios);
      if (!cod && result.municipios.length) setCod(result.municipios[0].cod_mun_ibge);
    });
  }, [dimensao]);

  useEffect(() => {
    if (!cod) return;
    setLoading(true);
    fetchSimMunicipio(cod, ano, dimensao).then(setDetail).finally(() => setLoading(false));
  }, [cod, ano, dimensao]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>Municipio no SIM</h1>
          <p className="text-xs" style={{ color: "var(--ink-2)" }}>Consulta por ocorrencia ou residencia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Dimensao" value={dimensao} onChange={(event) => { setDimensao(event.target.value as FilterValues["dimensao"]); setDetail(null); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
            <option value="ocorrencia">Ocorrencia</option>
            <option value="residencia">Residencia</option>
          </select>
          <select aria-label="Municipio" value={cod} onChange={(event) => setCod(event.target.value)} className="max-w-64 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
            {municipios.map((row) => <option key={row.cod_mun_ibge} value={row.cod_mun_ibge}>{row.municipio} ({row.uf})</option>)}
          </select>
          <select aria-label="Ano" value={ano ?? ""} onChange={(event) => setAno(event.target.value ? Number(event.target.value) : undefined)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
            <option value="">Todos os anos</option>
            {anos.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      <BarraDeRecorte
        chips={[
          { rotulo: "Dimensão", valor: dimensao === "residencia" ? "Residência" : "Ocorrência" },
          ...(detail ? [{ rotulo: "Município", valor: `${detail.municipio} (${detail.uf})` }] : []),
          { rotulo: "Ano", valor: ano ? String(ano) : "Todos" },
        ]}
        n={detail?.total_obitos ?? 0}
        aoClicarLink={copiarLinkDoRecorte}
      />

      {loading && <div className="p-8 text-center text-sm" style={{ color: "var(--ink-2)" }}>Carregando...</div>}
      {!loading && detail && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiStat rotulo="Obitos" valor={formatNumber(detail.total_obitos)} denominador={`${detail.municipio} - ${detail.uf}`} />
            <KpiStat
              rotulo="Taxa / 100 mil"
              valor={detail.taxa_obitos_100mil == null ? "N/D" : formatTaxa100k(detail.taxa_obitos_100mil)}
              denominador={
                (detail.populacao_origem === "estimada"
                  ? `Populacao estimada (${detail.populacao_ano_referencia}, defasagem ${detail.populacao_defasagem_anos} ${detail.populacao_defasagem_anos === 1 ? "ano" : "anos"})`
                  : detail.populacao_origem === "exata"
                    ? "Populacao do mesmo ano"
                    : "Denominador indisponivel") +
                // Auditoria A4: mesmo aviso de instabilidade estatistica do
                // ranking (G1 do motor de leitura so olha o N do recorte
                // inteiro, nunca o de um municipio so).
                (detail.taxa_obitos_100mil != null && taxaInstavel(detail.total_obitos, detail.populacao)
                  ? ` · taxa instável (${detail.total_obitos} óbitos)`
                  : "")
              }
              termoAjuda="taxa_100mil"
            />
            <KpiStat rotulo="Frota SENATRAN" valor={detail.frota_total == null ? "N/D" : formatNumber(detail.frota_total)} denominador={detail.frota_status === "disponivel" ? "Estoque dez./mesmo ano" : "Denominador indisponivel"} />
            <KpiStat rotulo="Taxa / 10 mil veic." valor={detail.taxa_obitos_10mil_veiculos == null ? "N/D" : formatTaxa10k(detail.taxa_obitos_10mil_veiculos)} denominador={detail.frota_status === "disponivel" ? "Obitos ATT / frota" : "Sem frota pareada"} termoAjuda="taxa_10mil_veiculos" />
            <KpiStat rotulo="Dimensao" valor={detail.dimensao} denominador="Papel geografico" termoAjuda="dimensao_ocorrencia_residencia" />
          </div>
          <GraficoMoldura medidaId="serie_mensal_obitos" leitura={leituraSerie}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={detail.serie_mensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
                <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
                <Line type="monotone" dataKey="obitos" stroke="var(--risk-5)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </GraficoMoldura>
          <p className="flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Populacao IBGE: {detail.populacao == null ? "N/D" : formatNumber(detail.populacao)} ({detail.populacao_status}
            {detail.populacao_origem === "estimada" ? ", estimada" : detail.populacao_origem === "exata" ? ", exata" : ""}).
            <PopulacaoBadge
              origem={detail.populacao_origem}
              anoReferencia={detail.populacao_ano_referencia}
              defasagemAnos={detail.populacao_defasagem_anos}
            />
            Frota SENATRAN: {detail.frota_status}. Taxa veicular so e estimada com frota do mesmo municipio e ano.
          </p>
        </>
      )}
    </div>
  );
}
