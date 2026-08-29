"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { competencia: string; valor: number; }
interface ForecastPoint extends Point { lower: number; upper: number; }
interface Props { historico: Point[]; previsao: ForecastPoint[]; height?: number; }

export default function ForecastChart({ historico, previsao, height = 360 }: Props) {
  const last = historico.at(-1);
  if (!last) return null;
  const data = [...historico.map((point) => ({ competencia: point.competencia, real: point.valor, previsao: null as number | null, lower: null as number | null, upper: null as number | null, band: null as [number, number] | null })), { competencia: last.competencia, real: last.valor, previsao: last.valor, lower: last.valor, upper: last.valor, band: [last.valor, last.valor] as [number, number] }, ...previsao.map((point) => ({ competencia: point.competencia, real: null as number | null, previsao: point.valor, lower: point.lower, upper: point.upper, band: [point.lower, point.upper] as [number, number] }))];
  return <ResponsiveContainer width="100%" height={height}><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} /><YAxis tick={{ fontSize: 10, fill: "var(--chart-axis)" }} tickFormatter={(value) => String(Math.round(Number(value)))} /><Tooltip formatter={(value, name) => value == null || name === "band" ? [null, null] : [Math.round(Number(value)).toLocaleString("pt-BR"), name === "real" ? "Dados observados" : "Projecao"]} /><Legend formatter={(value) => value === "real" ? "Dados observados" : value === "previsao" ? "Projecao" : "Intervalo"} /><Area dataKey="band" fill="var(--risk-2)" stroke="none" fillOpacity={0.6} name="band" /><Line dataKey="real" stroke="var(--brand)" strokeWidth={2} dot={false} name="real" /><Line dataKey="previsao" stroke="var(--risk-5)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="previsao" /></ComposedChart></ResponsiveContainer>;
}
