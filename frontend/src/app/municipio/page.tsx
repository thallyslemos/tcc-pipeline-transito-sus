"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge, MapPinned, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import { fetchSimAnos, fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { formatNumber, formatTaxa10k } from "@/lib/format";
import PopulacaoBadge from "@/components/PopulacaoBadge";
import type { FilterValues, SimMunicipio, SimMunicipioDetail } from "@/lib/types";

export default function MunicipioPage() {
  const [dimensao, setDimensao] = useState<FilterValues["dimensao"]>("ocorrencia");
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [cod, setCod] = useState("");
  const [ano, setAno] = useState<number | undefined>();
  const [detail, setDetail] = useState<SimMunicipioDetail | null>(null);
  const [loading, setLoading] = useState(false);

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
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Municipio no SIM</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Consulta por ocorrencia ou residencia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Dimensao" value={dimensao} onChange={(event) => { setDimensao(event.target.value as FilterValues["dimensao"]); setDetail(null); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>
            <option value="ocorrencia">Ocorrencia</option>
            <option value="residencia">Residencia</option>
          </select>
          <select aria-label="Municipio" value={cod} onChange={(event) => setCod(event.target.value)} className="max-w-64 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>
            {municipios.map((row) => <option key={row.cod_mun_ibge} value={row.cod_mun_ibge}>{row.municipio} ({row.uf})</option>)}
          </select>
          <select aria-label="Ano" value={ano ?? ""} onChange={(event) => setAno(event.target.value ? Number(event.target.value) : undefined)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>
            <option value="">Todos os anos</option>
            {anos.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm" style={{ color: "var(--fg-muted)" }}>Carregando...</div>}
      {!loading && detail && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard title="Obitos" value={formatNumber(detail.total_obitos)} subtitle={`${detail.municipio} - ${detail.uf}`} icon={<AlertTriangle className="h-4 w-4" />} semantic="deaths" />
            <KpiCard
              title="Taxa / 100 mil"
              value={detail.taxa_obitos_100mil == null ? "N/D" : detail.taxa_obitos_100mil.toFixed(1)}
              subtitle={
                detail.populacao_origem === "estimada"
                  ? `Populacao estimada (${detail.populacao_ano_referencia}, defasagem ${detail.populacao_defasagem_anos} ${detail.populacao_defasagem_anos === 1 ? "ano" : "anos"})`
                  : detail.populacao_origem === "exata"
                    ? "Populacao do mesmo ano"
                    : "Denominador indisponivel"
              }
              icon={<Gauge className="h-4 w-4" />}
              semantic="health"
              infoTermo="taxa_100mil"
            />
            <KpiCard title="Frota SENATRAN" value={detail.frota_total == null ? "N/D" : formatNumber(detail.frota_total)} subtitle={detail.frota_status === "disponivel" ? "Estoque dez./mesmo ano" : "Denominador indisponivel"} icon={<Users className="h-4 w-4" />} semantic="success" />
            <KpiCard title="Taxa / 10 mil veic." value={detail.taxa_obitos_10mil_veiculos == null ? "N/D" : formatTaxa10k(detail.taxa_obitos_10mil_veiculos)} subtitle={detail.frota_status === "disponivel" ? "Obitos ATT / frota" : "Sem frota pareada"} icon={<Gauge className="h-4 w-4" />} semantic="health" />
            <KpiCard title="Dimensao" value={detail.dimensao} subtitle="Papel geografico" icon={<MapPinned className="h-4 w-4" />} semantic="success" />
          </div>
          <ChartCard title="Serie mensal" subtitle="Obitos ATT no periodo selecionado">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={detail.serie_mensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                <Tooltip formatter={(value) => [formatNumber(Number(value)), "Obitos"]} />
                <Line type="monotone" dataKey="obitos" stroke="var(--deaths)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <p className="flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
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
