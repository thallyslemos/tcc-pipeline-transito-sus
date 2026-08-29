"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/filters/FilterBar";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import { fetchMapa, fetchSimAnos, fetchSimMunicipios, fetchSimTipos } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { lerRecorteDaUrl, serializarRecorte } from "@/lib/url/recorte";
import type { FilterValues, MapPoint, SimMunicipio } from "@/lib/types";
import type { MapScaleMode } from "@/components/map/MapLegend";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });
const REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

// useSearchParams() exige boundary de Suspense na pre-renderizacao estatica
// do App Router (ver dashboard/page.tsx).
export default function MapaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Carregando...
        </div>
      }
    >
      <MapaContent />
    </Suspense>
  );
}

function MapaContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsIniciais = useSearchParams();
  const [filters, setFilters] = useState<FilterValues>(() => ({
    dimensao: "ocorrencia",
    ...lerRecorteDaUrl(searchParamsIniciais),
  }));
  const [anos, setAnos] = useState<number[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [data, setData] = useState<MapPoint[]>([]);
  const [municipios, setMunicipios] = useState<SimMunicipio[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [escala, setEscala] = useState<MapScaleMode>("total");
  const [loading, setLoading] = useState(true);

  // So auto-seleciona o ultimo ano na carga inicial, e so se nenhum ano ja
  // estiver definido (ver dashboard/page.tsx pro mesmo guard e o motivo).
  const anoInicializado = useRef(false);
  useEffect(() => {
    fetchSimAnos(filters.dimensao).then((result) => {
      setAnos(result.anos);
      if (!anoInicializado.current && result.anos.length) {
        anoInicializado.current = true;
        setFilters((current) => (current.ano == null ? { ...current, ano: result.anos.at(-1) } : current));
      }
    });
  }, [filters.dimensao]);

  // Estado -> URL, so-escrita (ver dashboard/page.tsx). Nao inclui `escala`
  // (nao faz parte de FilterValues/recorte.ts) — o link do recorte reproduz
  // o filtro, nao cada toggle de UI.
  useEffect(() => {
    const query = serializarRecorte(filters).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);
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
  const vehicleRateAvailable = data.some((row) => row.taxa_obitos_10mil_veiculos != null);

  useEffect(() => {
    if (!vehicleRateAvailable && escala === "vehicle_rate") setEscala("total");
  }, [escala, vehicleRateAvailable]);
  const chipsRecorte = useMemo(() => {
    const chips = [{ rotulo: "Dimensão", valor: filters.dimensao === "residencia" ? "Residência" : "Ocorrência" }];
    if (filters.uf) chips.push({ rotulo: "UF", valor: filters.uf });
    if (filters.regiao) chips.push({ rotulo: "Região", valor: filters.regiao });
    chips.push({ rotulo: "Ano", valor: filters.ano ? String(filters.ano) : "Todos" });
    if (filters.tipo_veiculo) chips.push({ rotulo: "Veículo", valor: filters.tipo_veiculo });
    return chips;
  }, [filters]);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
  };

  const filterDefs = [
    { key: "dimensao", label: "Dimensao", options: [{ value: "ocorrencia", label: "Ocorrencia" }, { value: "residencia", label: "Residencia" }] },
    { key: "regiao", label: "Regiao", options: REGIOES.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "uf", label: "UF", options: ufs.map((value) => ({ value, label: value })), placeholder: "Todas" },
    { key: "ano", label: "Ano", options: anos.map((value) => ({ value: String(value), label: String(value) })) },
    { key: "tipo_veiculo", label: "Veiculo", options: tipos.map((value) => ({ value, label: value })), placeholder: "Todos" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Mapa SIM</h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Obitos por municipio - {formatNumber(total)} no filtro atual
          </p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters as Record<string, string>}
          onChange={change}
          onReset={() => setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) })}
        />
      </div>
      <BarraDeRecorte chips={chipsRecorte} n={total} aoClicarLink={copiarLinkDoRecorte} />
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setEscala("total")}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: escala === "total" ? "var(--primary-soft)" : "var(--bg-card)" }}
        >
          Obitos absolutos
        </button>
        <button
          type="button"
          onClick={() => setEscala("relative")}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: escala === "relative" ? "var(--primary-soft)" : "var(--bg-card)" }}
        >
          Taxa / 100 mil
        </button>
        <button
          type="button"
          onClick={() => setEscala("vehicle_rate")}
          disabled={!vehicleRateAvailable}
          title={vehicleRateAvailable ? "Taxa calculada com frota SENATRAN" : "Taxa indisponivel sem denominador SENATRAN"}
          className="rounded-lg px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: escala === "vehicle_rate" ? "var(--primary-soft)" : "var(--bg-card)" }}
        >
          Taxa / 10 mil veiculos
        </button>
      </div>
      {!vehicleRateAvailable && (
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Taxa veicular indisponivel: o denominador SENATRAN ainda nao foi materializado para este recorte.
        </p>
      )}
      <div className="h-[560px] overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
            Carregando mapa...
          </div>
        ) : (
          <MapView
            data={data}
            metrica="obitos"
            dimensao={filters.dimensao}
            ano={filters.ano}
            uf={filters.uf}
            regiao={filters.regiao}
            tipo_veiculo={filters.tipo_veiculo}
            escala={escala}
          />
        )}
      </div>
      <div className="rounded-xl p-4 text-xs" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-secondary)" }}>
        Centroides sao opcionais; a camada cartografica usa prioritariamente os poligonos GeoJSON do IBGE.
        Os municipios sem registro permanecem no mapa em estado neutro. {municipios.length} municipios disponiveis para consulta.
      </div>
    </div>
  );
}
