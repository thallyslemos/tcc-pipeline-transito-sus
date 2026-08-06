"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

import FilterBar from "@/components/filters/FilterBar";
import { fetchSimAnos, fetchSimMunicipios } from "@/lib/api";
import { formatNumber, formatTaxa10k } from "@/lib/format";
import type { FilterValues, SimMunicipio } from "@/lib/types";

const PAGE_SIZE = 50;

type SortMode = "absolute" | "rate" | "vehicle_rate";

export default function RankingPage() {
  const [filters, setFilters] = useState<FilterValues>({ dimensao: "ocorrencia" });
  const [anos, setAnos] = useState<number[]>([]);
  const [rows, setRows] = useState<SimMunicipio[]>([]);
  const [total, setTotal] = useState(0);
  const [ufs, setUfs] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("rate");
  const [loading, setLoading] = useState(true);

  const vehicleRateAvailable = rows.some((row) => row.taxa_obitos_10mil_veiculos != null);

  useEffect(() => {
    fetchSimAnos(filters.dimensao).then((result) => {
      setAnos(result.anos);
      if (!filters.ano && result.anos.length) {
        setFilters((current) => ({ ...current, ano: result.anos.at(-1) }));
      }
    });
  }, [filters.dimensao, filters.ano]);

  useEffect(() => {
    setLoading(true);
    fetchSimMunicipios(filters, page, PAGE_SIZE)
      .then((result) => {
        setRows(result.municipios);
        setTotal(result.total);
        setUfs([...new Set(result.municipios.map((row) => row.uf))].sort());
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    if (!vehicleRateAvailable && sortMode === "vehicle_rate") setSortMode("rate");
  }, [vehicleRateAvailable, sortMode]);

  const handleChange = (key: string, value: string) => {
    setPage(1);
    setFilters((current) => {
      const next = { ...current };
      if (key === "dimensao") next.dimensao = value === "residencia" ? "residencia" : "ocorrencia";
      if (key === "ano") next.ano = value ? Number(value) : undefined;
      if (key === "uf") next.uf = value || undefined;
      return next;
    });
  };

  const ordered = [...rows].sort((a, b) => {
    if (sortMode === "absolute") return b.obitos - a.obitos;
    if (sortMode === "vehicle_rate") {
      return (b.taxa_obitos_10mil_veiculos ?? -1) - (a.taxa_obitos_10mil_veiculos ?? -1);
    }
    return (b.taxa_obitos_100mil ?? -1) - (a.taxa_obitos_100mil ?? -1);
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterDefs = [
    { key: "dimensao", label: "Dimensao", options: [{ value: "ocorrencia", label: "Ocorrencia" }, { value: "residencia", label: "Residencia" }] },
    { key: "uf", label: "UF", options: ufs.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "ano", label: "Ano", options: anos.map((value) => ({ value: String(value), label: String(value) })) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Ranking SIM</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Comparacao municipal com denominador explicito - {total} municipios
          </p>
        </div>
        <FilterBar filters={filterDefs} values={filters as Record<string, string>} onChange={handleChange} onReset={() => { setPage(1); setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) }); }} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--fg-secondary)" }}>
        <button className="rounded-lg px-3 py-1.5" style={{ backgroundColor: sortMode === "rate" ? "var(--primary-soft)" : "var(--bg-card)" }} onClick={() => setSortMode("rate")}>Taxa / 100 mil</button>
        <button
          className="rounded-lg px-3 py-1.5 disabled:opacity-40"
          style={{ backgroundColor: sortMode === "vehicle_rate" ? "var(--primary-soft)" : "var(--bg-card)" }}
          disabled={!vehicleRateAvailable}
          title={vehicleRateAvailable ? "Taxa por 10 mil veiculos (SENATRAN)" : "Indisponivel sem frota pareada no recorte"}
          onClick={() => setSortMode("vehicle_rate")}
        >
          Taxa / 10 mil veic.
        </button>
        <button className="rounded-lg px-3 py-1.5" style={{ backgroundColor: sortMode === "absolute" ? "var(--primary-soft)" : "var(--bg-card)" }} onClick={() => setSortMode("absolute")}>Obitos absolutos</button>
        <ArrowUpDown className="h-3.5 w-3.5" />
      </div>

      <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {loading ? <div className="p-8 text-center text-sm" style={{ color: "var(--fg-muted)" }}>Carregando...</div> : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--bg-muted)" }}>
              <tr className="text-xs" style={{ color: "var(--fg-muted)" }}>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Municipio</th>
                <th className="px-4 py-3 text-left">UF</th>
                <th className="px-4 py-3 text-right">Populacao</th>
                <th className="px-4 py-3 text-right">Frota</th>
                <th className="px-4 py-3 text-right">Obitos</th>
                <th className="px-4 py-3 text-right">Taxa / 100 mil</th>
                <th className="px-4 py-3 text-right">Taxa / 10 mil veic.</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, index) => (
                <tr key={row.cod_mun_ibge} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--fg-muted)" }}>{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="px-4 py-2 font-medium" style={{ color: "var(--fg)" }}>{row.municipio}</td>
                  <td className="px-4 py-2" style={{ color: "var(--fg-secondary)" }}>{row.uf}</td>
                  <td className="px-4 py-2 text-right">{row.populacao == null ? "N/D" : formatNumber(row.populacao)}</td>
                  <td className="px-4 py-2 text-right">{row.frota_total == null ? "N/D" : formatNumber(row.frota_total)}</td>
                  <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--deaths)" }}>{formatNumber(row.obitos)}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.taxa_obitos_100mil == null ? "N/D" : row.taxa_obitos_100mil.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.taxa_obitos_10mil_veiculos == null ? "N/D" : formatTaxa10k(row.taxa_obitos_10mil_veiculos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--fg-muted)" }}>
          <span>{total ? `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)} de ${total}` : "Sem dados"}</span>
          <div className="flex items-center gap-2">
            <button aria-label="Pagina anterior" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded p-1 disabled:opacity-30" style={{ border: "1px solid var(--border)" }}><ChevronLeft className="h-4 w-4" /></button>
            <span>{page} / {totalPages}</span>
            <button aria-label="Proxima pagina" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded p-1 disabled:opacity-30" style={{ border: "1px solid var(--border)" }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
