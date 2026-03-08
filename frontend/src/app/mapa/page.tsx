"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import FilterBar from "@/components/filters/FilterBar";
import MapLegend from "@/components/map/MapLegend";
import { fetchAnos, fetchMapa } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { MapPoint } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

const TABLE_PAGE_SIZE = 30;

export default function MapaPage() {
  const [anos, setAnos] = useState<number[]>([]);
  const [data, setData] = useState<MapPoint[]>([]);
  const [metrica, setMetrica] = useState("obitos");
  const [ano, setAno] = useState("");
  const [loading, setLoading] = useState(true);
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    fetchAnos().then((a) => setAnos(a.anos));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setTablePage(0);
    fetchMapa(metrica, ano ? Number(ano) : undefined)
      .then((r) => setData(r.dados))
      .finally(() => setLoading(false));
  }, [metrica, ano]);

  useEffect(load, [load]);

  const total = data.reduce((s, d) => s + d.valor, 0);
  const sorted = [...data].sort((a, b) => b.valor - a.valor);
  const totalTablePages = Math.ceil(sorted.length / TABLE_PAGE_SIZE);
  const pagedData = sorted.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Mapa de Calor</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Distribuição geográfica por município · {data.length} municípios
          </p>
        </div>
        <FilterBar
          filters={[
            {
              key: "metrica", label: "Métrica",
              options: [
                { value: "obitos", label: "Óbitos" },
                { value: "custos", label: "Custos (R$)" },
              ],
              placeholder: "Óbitos",
            },
            {
              key: "ano", label: "Ano",
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

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg px-4 py-2"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Total {metrica === "custos" ? "custos" : "óbitos"}
          </p>
          <p className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            {metrica === "custos" ? formatCurrency(total) : formatNumber(total)}
          </p>
        </div>
        <MapLegend metrica={metrica} />
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-xl"
        style={{
          height: "calc(100vh - 280px)",
          minHeight: "400px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)" }}>
            <div className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
          </div>
        )}
        <MapView data={data} metrica={metrica} />
      </div>

      {/* Table with Pagination */}
      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
            Ranking por Município
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: "var(--bg-muted)" }}>
              <tr className="text-xs" style={{ color: "var(--fg-muted)" }}>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Município</th>
                <th className="px-4 py-2">UF</th>
                <th className="px-4 py-2 text-right">
                  {metrica === "custos" ? "Custo Total" : "Óbitos"}
                </th>
                <th className="px-4 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.map((d, i) => (
                <tr key={d.cod_mun_ibge}
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--fg-muted)" }}>
                    {tablePage * TABLE_PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-2 font-medium" style={{ color: "var(--fg)" }}>{d.municipio}</td>
                  <td className="px-4 py-2" style={{ color: "var(--fg-secondary)" }}>{d.uf}</td>
                  <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--fg)" }}>
                    {metrica === "custos" ? formatCurrency(d.valor) : formatNumber(d.valor)}
                  </td>
                  <td className="px-4 py-2 text-right" style={{ color: "var(--fg-muted)" }}>
                    {total > 0 ? ((d.valor / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalTablePages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3"
            style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
              style={{ border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums" style={{ color: "var(--fg-secondary)" }}>
              {tablePage + 1} / {totalTablePages}
            </span>
            <button onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))}
              disabled={tablePage >= totalTablePages - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
              style={{ border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
