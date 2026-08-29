"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

import FilterBar from "@/components/filters/FilterBar";
import BarraDeRecorte from "@/components/ui/BarraDeRecorte";
import { fetchSimAnos, fetchSimMunicipios } from "@/lib/api";
import { formatNumber, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { lerRecorteDaUrl, serializarRecorte } from "@/lib/url/recorte";
import PopulacaoBadge from "@/components/PopulacaoBadge";
import SeloQualidade from "@/components/ui/SeloQualidade";
import { taxaInstavel } from "@/content/qualidade";
import type { FilterValues, SimMunicipio } from "@/lib/types";

const PAGE_SIZE = 50;

type SortMode = "absolute" | "rate" | "vehicle_rate";

// useSearchParams() exige boundary de Suspense na pre-renderizacao estatica
// do App Router (ver dashboard/page.tsx).
export default function RankingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-sm" style={{ color: "var(--ink-2)" }}>
          Carregando...
        </div>
      }
    >
      <RankingContent />
    </Suspense>
  );
}

function RankingContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsIniciais = useSearchParams();
  const [filters, setFilters] = useState<FilterValues>(() => ({
    dimensao: "ocorrencia",
    ...lerRecorteDaUrl(searchParamsIniciais),
  }));
  const [anos, setAnos] = useState<number[]>([]);
  const [rows, setRows] = useState<SimMunicipio[]>([]);
  const [total, setTotal] = useState(0);
  const [ufs, setUfs] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("rate");
  const [loading, setLoading] = useState(true);

  const vehicleRateAvailable = rows.some((row) => row.taxa_obitos_10mil_veiculos != null);

  // So auto-seleciona o ultimo ano na carga inicial, e so se nenhum ano ja
  // estiver definido (nem da URL nem de escolha do usuario) — ver
  // dashboard/page.tsx pro mesmo guard e o motivo.
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

  // Estado -> URL, so-escrita (ver dashboard/page.tsx).
  useEffect(() => {
    const query = serializarRecorte(filters).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

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

  const chipsRecorte = useMemo(() => {
    const chips = [{ rotulo: "Dimensão", valor: filters.dimensao === "residencia" ? "Residência" : "Ocorrência" }];
    if (filters.uf) chips.push({ rotulo: "UF", valor: filters.uf });
    chips.push({ rotulo: "Ano", valor: filters.ano ? String(filters.ano) : "Todos" });
    return chips;
  }, [filters]);

  const copiarLinkDoRecorte = () => {
    if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.href);
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
          <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>Ranking SIM</h1>
          <p className="text-xs" style={{ color: "var(--ink-2)" }}>
            Comparacao municipal com denominador explicito - {total} municipios
          </p>
        </div>
        <FilterBar filters={filterDefs} values={filters as Record<string, string>} onChange={handleChange} onReset={() => { setPage(1); setFilters({ dimensao: "ocorrencia", ano: anos.at(-1) }); }} />
      </div>

      <BarraDeRecorte chips={chipsRecorte} n={total} aoClicarLink={copiarLinkDoRecorte} />

      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--ink-2)" }}>
        <button className="rounded-lg px-3 py-1.5" style={{ backgroundColor: sortMode === "rate" ? "var(--brand-soft)" : "var(--surface)" }} onClick={() => setSortMode("rate")}>Taxa / 100 mil</button>
        <button
          className="rounded-lg px-3 py-1.5 disabled:opacity-40"
          style={{ backgroundColor: sortMode === "vehicle_rate" ? "var(--brand-soft)" : "var(--surface)" }}
          disabled={!vehicleRateAvailable}
          title={vehicleRateAvailable ? "Taxa por 10 mil veiculos (SENATRAN)" : "Indisponivel sem frota pareada no recorte"}
          onClick={() => setSortMode("vehicle_rate")}
        >
          Taxa / 10 mil veic.
        </button>
        <button className="rounded-lg px-3 py-1.5" style={{ backgroundColor: sortMode === "absolute" ? "var(--brand-soft)" : "var(--surface)" }} onClick={() => setSortMode("absolute")}>Obitos absolutos</button>
        <ArrowUpDown className="h-3.5 w-3.5" />
      </div>

      <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        {loading ? <div className="p-8 text-center text-sm" style={{ color: "var(--ink-2)" }}>Carregando...</div> : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--sunken)" }}>
              <tr className="text-xs" style={{ color: "var(--ink-2)" }}>
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
                  <td className="px-4 py-2" style={{ color: "var(--ink-2)" }}>{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="px-4 py-2 font-medium" style={{ color: "var(--ink)" }}>{row.municipio}</td>
                  <td className="px-4 py-2" style={{ color: "var(--ink-2)" }}>{row.uf}</td>
                  <td className="px-4 py-2 text-right">{row.populacao == null ? "N/D" : formatNumber(row.populacao)}</td>
                  <td className="px-4 py-2 text-right">{row.frota_total == null ? "N/D" : formatNumber(row.frota_total)}</td>
                  {/* Auditoria M2: a cor de uma celula deve vir do valor que
                      ELA mostra. Obitos e contagem bruta, nao e classificado
                      por classe de risco (quem e classificado e a taxa, na
                      proxima coluna) — --risk-5 fixo aqui emprestava uma
                      semantica de classificacao que nao existe pra essa
                      coluna. */}
                  <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--ink)" }}>{formatNumber(row.obitos)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    <span className="inline-flex items-center gap-1">
                      {row.taxa_obitos_100mil == null ? "N/D" : formatTaxa100k(row.taxa_obitos_100mil)}
                      <PopulacaoBadge
                        origem={row.populacao_origem}
                        anoReferencia={row.populacao_ano_referencia}
                        defasagemAnos={row.populacao_defasagem_anos}
                      />
                      {/* Auditoria A4: G1 (motor de leitura) so guarda o N do
                          recorte inteiro, nunca o de uma linha — um
                          municipio com poucos obitos pode liderar o ranking
                          por taxa so por acaso de contagem pequena. */}
                      {row.taxa_obitos_100mil != null && taxaInstavel(row.obitos, row.populacao) && (
                        <SeloQualidade entrada={{ motivo: "taxa_instavel", obitos: row.obitos }} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.taxa_obitos_10mil_veiculos == null ? "N/D" : formatTaxa10k(row.taxa_obitos_10mil_veiculos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--ink-2)" }}>
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
