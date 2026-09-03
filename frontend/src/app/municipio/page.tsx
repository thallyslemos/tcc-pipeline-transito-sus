"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import ThemedTooltip from "@/components/charts/ThemedTooltip";
import GraficoMoldura from "@/components/ui/GraficoMoldura";
import KpiStat from "@/components/ui/KpiStat";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import FilterBar from "@/components/filters/FilterBar";
import { fetchSimAnos, fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { buildAnoOptions, buildDimensaoOptions, buildUfOptions, buscarMunicipioFilterOptions } from "@/lib/filtros/buildFilterDefs";
import { formatNumber, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import { useRecorte } from "@/lib/url/useRecorte";
import PopulacaoBadge from "@/components/PopulacaoBadge";
import { taxaInstavel } from "@/content/qualidade";
import type { SimMunicipio, SimMunicipioDetail } from "@/lib/types";

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
  const { recorte, patchRecorte, registrarAnosDisponiveis } = useRecorte();
  const dimensao = recorte.dimensao ?? "ocorrencia";
  const cod = recorte.municipio ?? "";
  const ano = recorte.ano;
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [detail, setDetail] = useState<SimMunicipioDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
  };

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
      registrarAnosDisponiveis(result.anos);
      if (recorte.ano != null && !result.anos.includes(recorte.ano)) {
        patchRecorte({ ano: result.anos.at(-1) });
      } else if (!recorte.ano && result.anos.length) {
        patchRecorte({ ano: result.anos.at(-1) });
      }
    });
    fetchSimMunicipios({ dimensao, uf: recorte.uf }, 1, 200).then((result) => {
      setMunicipios(result.municipios);
      const codValido = cod && result.municipios.some((m) => m.cod_mun_ibge === cod);
      if (cod && !codValido) {
        patchRecorte({ municipio: undefined });
      } else if (!cod && result.municipios.length) {
        patchRecorte({ municipio: result.municipios[0].cod_mun_ibge });
      }
    });
  }, [dimensao, recorte.uf, cod, patchRecorte, registrarAnosDisponiveis, recorte.ano]);

  useEffect(() => {
    if (!cod) return;
    setLoading(true);
    fetchSimMunicipio(cod, ano, dimensao)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [cod, ano, dimensao]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          Consulta municipal
        </h1>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          Serie mensal e indicadores por municipio
        </p>
      </div>

      <FilterBar
        filters={[
          { key: "dimensao", label: "Dimensao", options: buildDimensaoOptions() },
          { key: "ano", label: "Ano", options: buildAnoOptions(anos), placeholder: "Todos" },
          {
            key: "municipio",
            label: "Municipio",
            options: municipios.map((row) => ({
              value: row.cod_mun_ibge,
              label: `${row.municipio} (${row.uf})`,
            })),
            variant: "combobox",
            onSearch: (term) => buscarMunicipioFilterOptions(term, dimensao, recorte.uf),
          },
        ]}
        values={{
          dimensao,
          ano: ano != null ? String(ano) : "",
          municipio: cod,
        }}
        onChange={(key, value) => {
          if (key === "dimensao") patchRecorte({ dimensao: value === "residencia" ? "residencia" : "ocorrencia" });
          if (key === "ano") patchRecorte({ ano: value ? Number(value) : undefined });
          if (key === "municipio") patchRecorte({ municipio: value || undefined });
        }}
      />

      <BarraDeRecorte
        chips={[
          { rotulo: "Dimensão", valor: dimensao === "residencia" ? "Residência" : "Ocorrência" },
          { rotulo: "Ano", valor: ano ? String(ano) : "Todos" },
          ...(detail ? [{ rotulo: "Município", valor: `${detail.municipio} (${detail.uf})` }] : []),
        ]}
        n={detail?.total_obitos ?? 0}
        aoClicarLink={copiarLinkDoRecorte}
      />

      {loading && (
        <div className="flex h-16 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando municipio...
        </div>
      )}

      {detail && !loading && (
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
                (detail.taxa_obitos_100mil != null && taxaInstavel(detail.total_obitos, detail.populacao)
                  ? ` · taxa instável (${detail.total_obitos} óbitos)`
                  : "")
              }
              termoAjuda="taxa_100mil"
            />
            <KpiStat
              rotulo="Frota SENATRAN"
              valor={detail.frota_total == null ? "N/D" : formatNumber(detail.frota_total)}
              denominador={detail.frota_status === "disponivel" ? "Estoque dez./mesmo ano" : "Denominador indisponivel"}
            />
            <KpiStat
              rotulo="Taxa / 10 mil veic."
              valor={detail.taxa_obitos_10mil_veiculos == null ? "N/D" : formatTaxa10k(detail.taxa_obitos_10mil_veiculos)}
              denominador={detail.frota_status === "disponivel" ? "Obitos ATT / frota" : "Sem frota pareada"}
              termoAjuda="taxa_10mil_veiculos"
            />
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
