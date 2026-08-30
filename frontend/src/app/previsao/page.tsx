"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import ThemedTooltip from "@/components/charts/ThemedTooltip";
import { fetchSimMunicipio, fetchSimMunicipios } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { gerarLeitura } from "@/lib/leitura";
import GraficoMoldura from "@/components/ui/GraficoMoldura";
import { useRecorte } from "@/lib/url/useRecorte";
import type { SimMunicipio, SimMunicipioDetail } from "@/lib/types";

export default function PrevisaoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando...
        </div>
      }
    >
      <PrevisaoContent />
    </Suspense>
  );
}

function PrevisaoContent() {
  const { recorte, patchRecorte } = useRecorte();
  const dimensao = recorte.dimensao ?? "ocorrencia";
  const cod = recorte.municipio ?? "";
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [data, setData] = useState<SimMunicipioDetail | null>(null);

  useEffect(() => {
    fetchSimMunicipios({ dimensao, uf: recorte.uf }, 1, 200).then((result) => {
      setMunicipios(result.municipios);
      if (!cod && result.municipios.length) {
        patchRecorte({ municipio: result.municipios[0].cod_mun_ibge });
      }
    });
  }, [dimensao, recorte.uf, cod, patchRecorte]);

  useEffect(() => {
    if (cod) fetchSimMunicipio(cod, undefined, dimensao).then(setData);
  }, [cod, dimensao]);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          Tendencias SIM
        </h1>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          Variacao temporal observada — projecoes TimesFM em desenvolvimento (ver backlog).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Dimensao"
          value={dimensao}
          onChange={(event) =>
            patchRecorte({ dimensao: event.target.value === "residencia" ? "residencia" : "ocorrencia" })
          }
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
        >
          <option value="ocorrencia">Ocorrencia</option>
          <option value="residencia">Residencia</option>
        </select>
        <select
          aria-label="Municipio"
          value={cod}
          onChange={(event) => patchRecorte({ municipio: event.target.value })}
          className="min-w-[220px] rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
        >
          {municipios.map((row) => (
            <option key={row.cod_mun_ibge} value={row.cod_mun_ibge}>
              {row.municipio} ({row.uf})
            </option>
          ))}
        </select>
      </div>
      {data && (
        <GraficoMoldura medidaId="serie_mensal_obitos" leitura={leituraSerie} proveniencia={`${data.municipio} · ${data.dimensao}`}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data.serie_mensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
              <ThemedTooltip formatter={(value: number) => [formatNumber(Number(value)), "Obitos"]} />
              <Line dataKey="obitos" type="monotone" stroke="var(--risk-5)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </GraficoMoldura>
      )}
    </div>
  );
}
