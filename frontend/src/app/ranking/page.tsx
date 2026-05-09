"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

import FilterBar from "@/components/filters/FilterBar";
import { fetchAnos, fetchMunicipios, fetchRanking, type RankingItem } from "@/lib/api";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { FilterValues, Municipio } from "@/lib/types";

const PAGE_SIZE = 50;

const METRICAS = [
  { value: "taxa_obitos_100mil", label: "Taxa Mortalidade (por 100k)" },
  { value: "custo_per_capita", label: "Custo per Capita (R$)" },
];

const REGIOES = {
  "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Sudeste": ["ES", "MG", "RJ", "SP"],
  "Sul": ["PR", "RS", "SC"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
};

type SortKey = keyof RankingItem;

export default function RankingPage() {
  const [anos, setAnos] = useState<number[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterValues>({
    ano: undefined,
    regiao: undefined,
    uf: undefined,
  });
  const [metrica, setMetrica] = useState("taxa_obitos_100mil");

  const [data, setData] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("taxa_obitos_100mil");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchAnos().then((a) => {
      setAnos(a.anos);
      if (a.anos.length > 0 && !filters.ano) {
        setFilters((f) => ({ ...f, ano: a.anos.at(-1) }));
      }
    });
  }, []);

  useEffect(() => {
    if (!filters.ano) return;
    fetchMunicipios({ ano: filters.ano }).then((m) => {
      setMunicipios(m.municipios);
      const availableUfs = [...new Set(m.municipios.map((mun) => mun.uf))].sort();
      setUfs(availableUfs);
    });
  }, [filters.ano]);

  const load = useCallback(() => {
    if (!filters.ano) return;
    setLoading(true);
    fetchRanking(filters.ano, metrica, {
      uf: filters.uf,
      regiao: filters.regiao,
    })
      .then((r) => setData(r.ranking))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [filters.ano, metrica, filters.uf, filters.regiao]);

  useEffect(load, [load]);

  const handleFilterChange = (key: string, value: string) => {
    if (key === "metrica") {
      setMetrica(value);
      setSortKey(value as SortKey);
      setPage(0);
      return;
    }

    const newFilters: FilterValues = { ...filters };

    if (key === "regiao") {
      newFilters.uf = undefined;
      newFilters.regiao = value as FilterValues["regiao"];
    } else if (key === "uf") {
      newFilters.regiao = undefined;
      newFilters.uf = value;
    } else if (key === "ano") {
      newFilters.ano = value ? Number(value) : undefined;
    }

    setPage(0);
    setFilters(newFilters);
  };

  const handleReset = () => {
    const latestYear = anos.length > 0 ? anos.at(-1) : undefined;
    setFilters({ ano: latestYear });
    setMetrica("taxa_obitos_100mil");
    setPage(0);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  };

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1" />
    );
  };

  const filterDefs = [
    {
      key: "metrica",
      label: "Métrica",
      options: METRICAS,
    },
    {
      key: "regiao",
      label: "Região",
      options: Object.keys(REGIOES).map((r) => ({ value: r, label: r })),
      placeholder: "Todas as regiões",
    },
    {
      key: "uf",
      label: "UF",
      options: ufs.map((u) => ({ value: u, label: u })),
      placeholder: "Todos os estados",
    },
    {
      key: "ano",
      label: "Ano",
      options: anos.map((a) => ({ value: String(a), label: String(a) })),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Ranking de Municípios
          </h1>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Comparativo por indicador relativo · {data.length} municípios
          </p>
        </div>
        <FilterBar
          filters={filterDefs}
          values={filters as Record<string, string>}
          onChange={(k, v) => handleFilterChange(k as keyof FilterValues, v)}
          onReset={handleReset}
        />
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4"
            style={{
              borderColor: "var(--border)",
              borderTopColor: "var(--primary)",
            }}
          />
        </div>
      )}

      {!loading && (
        <>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: "var(--bg-muted)" }}>
                  <tr className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    <th className="px-4 py-3 text-left">#</th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("municipio")}
                    >
                      Município <SortIcon col="municipio" />
                    </th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("uf")}
                    >
                      UF <SortIcon col="uf" />
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("populacao")}
                    >
                      População <SortIcon col="populacao" />
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("obitos")}
                    >
                      Óbitos <SortIcon col="obitos" />
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("taxa_obitos_100mil")}
                    >
                      Taxa (por 100k) <SortIcon col="taxa_obitos_100mil" />
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("custo_total")}
                    >
                      Custo Total <SortIcon col="custo_total" />
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-var(--fg)"
                      onClick={() => handleSort("custo_per_capita")}
                    >
                      Custo per Capita <SortIcon col="custo_per_capita" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <tr
                      key={item.cod_mun_ibge}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-4 py-2" style={{ color: "var(--fg-muted)" }}>
                        {page * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-4 py-2 font-medium" style={{ color: "var(--fg)" }}>
                        {item.municipio}
                      </td>
                      <td className="px-4 py-2" style={{ color: "var(--fg-secondary)" }}>
                        {item.uf}
                      </td>
                      <td className="px-4 py-2 text-right" style={{ color: "var(--fg)" }}>
                        {formatNumber(item.populacao)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--deaths)" }}>
                        {formatNumber(item.obitos)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--fg)" }}>
                        {item.taxa_obitos_100mil.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--costs)" }}>
                        {formatCurrency(item.custo_total)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "var(--fg)" }}>
                        {item.custo_per_capita.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} de{" "}
                  {sorted.length} municípios
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}