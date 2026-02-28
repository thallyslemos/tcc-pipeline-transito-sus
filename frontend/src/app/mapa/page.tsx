"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import FilterBar from "@/components/filters/FilterBar";
import MapLegend from "@/components/map/MapLegend";
import { fetchAnos, fetchMapa } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { MapPoint } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

export default function MapaPage() {
  const [anos, setAnos] = useState<number[]>([]);
  const [data, setData] = useState<MapPoint[]>([]);
  const [metrica, setMetrica] = useState("obitos");
  const [ano, setAno] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnos().then((a) => setAnos(a.anos));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchMapa(metrica, ano ? Number(ano) : undefined)
      .then((r) => setData(r.dados))
      .finally(() => setLoading(false));
  }, [metrica, ano]);

  useEffect(load, [load]);

  const total = data.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Mapa de Calor</h1>
          <p className="text-xs text-slate-400">
            Distribuicao geografica por municipio - {data.length} municipios
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterBar
            filters={[
              {
                key: "metrica",
                label: "Metrica",
                options: [
                  { value: "obitos", label: "Obitos" },
                  { value: "custos", label: "Custos (R$)" },
                ],
                placeholder: "Obitos",
              },
              {
                key: "ano",
                label: "Ano",
                options: anos.map((a) => ({ value: String(a), label: String(a) })),
              },
            ]}
            values={{ metrica, ano }}
            onChange={(k, v) => {
              if (k === "metrica") setMetrica(v || "obitos");
              else setAno(v);
            }}
          />
        </div>
      </div>

      {/* summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <p className="text-[10px] font-medium uppercase text-slate-400">
            Total {metrica === "custos" ? "custos" : "obitos"}
          </p>
          <p className="text-lg font-bold text-slate-800">
            {metrica === "custos" ? formatCurrency(total) : formatNumber(total)}
          </p>
        </div>
        <MapLegend metrica={metrica} />
      </div>

      {/* map */}
      <div className="relative h-[calc(100vh-280px)] min-h-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}
        <MapView data={data} metrica={metrica} />
      </div>

      {/* table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Ranking por Municipio</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Municipio</th>
                <th className="px-4 py-2">UF</th>
                <th className="px-4 py-2 text-right">
                  {metrica === "custos" ? "Custo Total" : "Obitos"}
                </th>
                <th className="px-4 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((d, i) => (
                <tr key={d.cod_mun_ibge} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-700">{d.municipio}</td>
                  <td className="px-4 py-2 text-slate-500">{d.uf}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-700">
                    {metrica === "custos" ? formatCurrency(d.valor) : formatNumber(d.valor)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">
                    {total > 0 ? ((d.valor / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
