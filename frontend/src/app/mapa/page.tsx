"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import FilterBar from "@/components/filters/FilterBar";
import { fetchMapa, fetchSimAnos, fetchSimMunicipios, fetchSimTipos } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { FilterValues, MapPoint, SimMunicipio } from "@/lib/types";
import type { MapScaleMode } from "@/components/map/MapLegend";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });
const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

export default function MapaPage() {
  const [filters, setFilters] = useState<FilterValues>({ dimensao: "ocorrencia" });
  const [anos, setAnos] = useState<number[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [data, setData] = useState<MapPoint[]>([]);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [escala, setEscala] = useState<MapScaleMode>("total");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimAnos(filters.dimensao).then((result) => { setAnos(result.anos); if (!filters.ano && result.anos.length) setFilters((current) => ({ ...current, ano: result.anos.at(-1) })); });
  }, [filters.dimensao, filters.ano]);
  useEffect(() => {
    fetchSimTipos(filters.dimensao).then((result) => setTipos(result.tipos));
    fetchSimMunicipios({ dimensao: filters.dimensao }, 1, 200).then((result) => { setMunicipios(result.municipios); setUfs([...new Set(result.municipios.map((row) => row.uf))].sort()); });
  }, [filters.dimensao]);
  useEffect(() => {
    setLoading(true);
    fetchMapa(filters).then((result) => setData(result.dados)).finally(() => setLoading(false));
  }, [filters]);

  const change = (key: string, value: string) => {
    setFilters((current) => {
      const next = { ...current };
      if (key === "dimensao") next.dimensao = value === "residencia" ? "residencia" : "ocorrencia";
      if (key === "ano") next.ano = value ? Number(value) : undefined;
      if (key === "uf") next.uf = value || undefined;
      if (key === "regiao") next.regiao = value || undefined;
      if (key === "tipo_veiculo") next.tipo_veiculo = value || undefined;
      return next;
    });
  };
  const total = data.reduce((sum, row) => sum + row.valor, 0);
  const filterDefs = [
    { key: "dimensao", label: "Dimensao", options: [{ value: "ocorrencia", label: "Ocorrencia" }, { value: "residencia", label: "Residencia" }] },
    { key: "regiao", label: "Regiao", options: REGIOES.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "uf", label: "UF", options: ufs.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "ano", label: "Ano", options: anos.map((value) => ({ value: String(value), label: String(value) })) },
    { key: "tipo_veiculo", label: "Veiculo", options: tipos.map((value) => ({ value, label: value })), placeholder: "Todos" },
  ];
  return <div className="space-y-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Mapa SIM</h1><p className="text-xs" style={{ color: "var(--fg-muted)" }}>Obitos por municipio - {formatNumber(total)} no filtro atual</p></div><FilterBar filters={filterDefs} values={filters as Record<string, string>} onChange={change} onReset={() => setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) })} /></div><div className="flex items-center gap-2 text-xs"><button onClick={() => setEscala("total")} className="rounded-lg px-3 py-1.5" style={{ backgroundColor: escala === "total" ? "var(--primary-soft)" : "var(--bg-card)" }}>Obitos absolutos</button><button onClick={() => setEscala("relative")} className="rounded-lg px-3 py-1.5" style={{ backgroundColor: escala === "relative" ? "var(--primary-soft)" : "var(--bg-card)" }}>Taxa / 100 mil</button></div><div className="h-[560px] overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>{loading ? <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>Carregando mapa...</div> : <MapView data={data} metrica="obitos" dimensao={filters.dimensao} ano={filters.ano} uf={filters.uf} regiao={filters.regiao} tipo_veiculo={filters.tipo_veiculo} escala={escala} />}</div><div className="rounded-xl p-4 text-xs" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>Centroides sao opcionais; a camada cartografica usa prioritariamente os poligonos GeoJSON do IBGE. {municipios.length} municipios disponiveis para consulta.</div></div>;
}
