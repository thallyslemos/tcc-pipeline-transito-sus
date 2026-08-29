"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import GraficoMoldura from "@/components/ui/GraficoMoldura";
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

export default function PrevisaoPage() {
  const [dimensao, setDimensao] = useState<FilterValues["dimensao"]>("ocorrencia");
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [cod, setCod] = useState("");
  const [data, setData] = useState<SimMunicipioDetail | null>(null);

  useEffect(() => {
    fetchSimMunicipios({ dimensao }, 1, 200).then((result) => { setMunicipios(result.municipios); if (!cod && result.municipios.length) setCod(result.municipios[0].cod_mun_ibge); });
  }, [dimensao]);
  useEffect(() => { if (cod) fetchSimMunicipio(cod, undefined, dimensao).then(setData); }, [cod, dimensao]);

  // Camada 3 (design/DESIGN_SYSTEM.md §6.2): serie_mensal e uma CONTAGEM, nao taxa.
  const leituraSerie = useMemo(() => {
    if (!data) return null;
    return gerarLeitura({
      g1: { totalObitos: data.total_obitos },
      r1: {
        pontos: data.serie_mensal.map((p) => ({ periodo: p.competencia, valor: p.obitos })),
        opcoes: { sujeito: "O total de óbitos", formatarValor: formatNumber },
      },
    });
  }, [data]);

  return <div className="space-y-5"><div><h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>Tendencias SIM</h1><p className="text-xs" style={{ color: "var(--ink-2)" }}>Serie observada para exploracao; previsoes serao habilitadas apos validacao metodologica.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Dimensao" value={dimensao} onChange={(event) => setDimensao(event.target.value as FilterValues["dimensao"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}><option value="ocorrencia">Ocorrencia</option><option value="residencia">Residencia</option></select><select aria-label="Municipio" value={cod} onChange={(event) => setCod(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>{municipios.map((row) => <option key={row.cod_mun_ibge} value={row.cod_mun_ibge}>{row.municipio} ({row.uf})</option>)}</select></div>{data && <GraficoMoldura medidaId="serie_mensal_obitos" leitura={leituraSerie} proveniencia={`${data.municipio} · ${data.dimensao}`}><ResponsiveContainer width="100%" height={320}><LineChart data={data.serie_mensal}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} /><ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} /><Line dataKey="obitos" type="monotone" stroke="var(--risk-5)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></GraficoMoldura>}</div>;
}
