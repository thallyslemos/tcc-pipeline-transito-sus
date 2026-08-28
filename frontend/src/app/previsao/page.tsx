"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import ChartCard from "@/components/charts/ChartCard";
import type { FilterValues, SimMunicipio, SimMunicipioDetail } from "@/lib/types";

export default function PrevisaoPage() {
  const [dimensao, setDimensao] = useState<FilterValues["dimensao"]>("ocorrencia");
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [cod, setCod] = useState("");
  const [data, setData] = useState<SimMunicipioDetail | null>(null);

  useEffect(() => {
    fetchSimMunicipios({ dimensao }, 1, 200).then((result) => { setMunicipios(result.municipios); if (!cod && result.municipios.length) setCod(result.municipios[0].cod_mun_ibge); });
  }, [dimensao]);
  useEffect(() => { if (cod) fetchSimMunicipio(cod, undefined, dimensao).then(setData); }, [cod, dimensao]);

  return <div className="space-y-5"><div><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Tendencias SIM</h1><p className="text-xs" style={{ color: "var(--fg-muted)" }}>Serie observada para exploracao; previsoes serao habilitadas apos validacao metodologica.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Dimensao" value={dimensao} onChange={(event) => setDimensao(event.target.value as FilterValues["dimensao"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}><option value="ocorrencia">Ocorrencia</option><option value="residencia">Residencia</option></select><select aria-label="Municipio" value={cod} onChange={(event) => setCod(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>{municipios.map((row) => <option key={row.cod_mun_ibge} value={row.cod_mun_ibge}>{row.municipio} ({row.uf})</option>)}</select></div>{data && <ChartCard title={`${data.municipio} - serie mensal`} subtitle={`${data.dimensao} - ${formatNumber(data.total_obitos)} Obitos`}><ResponsiveContainer width="100%" height={320}><LineChart data={data.serie_mensal}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-text)" }} /><YAxis tick={{ fontSize: 11, fill: "var(--chart-text)" }} /><Tooltip formatter={(value) => [formatNumber(Number(value)), "Obitos"]} /><Line dataKey="obitos" type="monotone" stroke="var(--deaths)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartCard>}</div>;
}
