"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, GitBranch } from "lucide-react";
import KpiStat from "@/components/ui/KpiStat";
import {
  fetchSimAnos,
  fetchSimFluxos,
  fetchSimFluxosGeo,
  fetchSimMunicipios,
  fetchSimTipos,
} from "@/lib/api";
import type { FluxoGeoFeatureCollection } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { SimFluxo, SimMunicipio } from "@/lib/types";

const FluxoMapView = dynamic(() => import("@/components/map/FluxoMapView"), { ssr: false });

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MunicipioCombobox({
  value,
  onChange,
}: {
  value: SimMunicipio | null;
  onChange: (m: SimMunicipio | null) => void;
}) {
  const [search, setSearch] = useState(value ? `${value.municipio} - ${value.uf}` : "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SimMunicipio[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setSearch(`${value.municipio} - ${value.uf}`);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetchSimMunicipios({ dimensao: "ocorrencia", municipio: term }, 1, 10)
        .then((r) => setResults(r.municipios))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
        Municipio alvo
      </label>
      <div className="relative">
        <input
          type="text"
          value={search}
          placeholder="Digite o nome ou codigo IBGE..."
          className="h-9 w-full rounded-lg px-2.5 pr-8 text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            ["--tw-ring-color" as string]: "var(--primary)",
          }}
          onFocus={() => { setOpen(true); doSearch(search); }}
          onChange={(e) => {
            const term = e.target.value;
            setSearch(term);
            setOpen(true);
            if (!term) { onChange(null); setResults([]); return; }
            doSearch(term);
          }}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4" style={{ color: "var(--fg-muted)" }} />
      </div>
      {open && (results.length > 0 || searching) && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg py-1 shadow-lg"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {searching && results.length === 0 && (
            <li className="px-3 py-2 text-sm" style={{ color: "var(--fg-muted)" }}>Buscando...</li>
          )}
          {results.map((m) => (
            <li
              key={m.cod_mun_ibge}
              className="cursor-pointer px-3 py-2 text-sm transition-colors"
              style={{ color: "var(--fg)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--primary-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(m);
                setSearch(`${m.municipio} - ${m.uf}`);
                setOpen(false);
                setResults([]);
              }}
            >
              <span className="font-medium">{m.municipio}</span>
              <span className="ml-2 text-[11px]" style={{ color: "var(--fg-muted)" }}>
                {m.uf} · {m.cod_mun_ibge}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FluxosPage() {
  const [direcao, setDirecao] = useState<"origens" | "destinos">("origens");
  const [ano, setAno] = useState<number | undefined>(undefined);
  const [tipoVeiculo, setTipoVeiculo] = useState<string | undefined>(undefined);
  const [municipioSelecionado, setMunicipioSelecionado] = useState<SimMunicipio | null>(null);

  const [anos, setAnos] = useState<number[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);

  const [fluxo, setFluxo] = useState<SimFluxo | null>(null);
  const [geoData, setGeoData] = useState<FluxoGeoFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSimAnos("ocorrencia").then((r) => {
      setAnos(r.anos);
      setAno(r.anos.at(-1));
    });
    fetchSimTipos("ocorrencia").then((r) => setTipos(r.tipos));
  }, []);

  useEffect(() => {
    if (!municipioSelecionado) return;
    const code = municipioSelecionado.cod_mun_ibge.slice(0, 6);
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSimFluxos(code, direcao, { ano, tipo_veiculo: tipoVeiculo }),
      fetchSimFluxosGeo(code, direcao, { ano, tipo_veiculo: tipoVeiculo }),
    ])
      .then(([f, g]) => {
        setFluxo(f);
        setGeoData(g);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar fluxos"))
      .finally(() => setLoading(false));
  }, [municipioSelecionado, direcao, ano, tipoVeiculo]);

  const codigoAlvo = municipioSelecionado?.cod_mun_ibge?.slice(0, 6) ?? "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
          Fluxos Residencia-Ocorrencia
        </h1>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Visualize a ligacao entre municipio de ocorrencia e municipio de residencia das vitimas
        </p>
      </div>

      {/* Controls */}
      <div
        className="flex flex-wrap items-end gap-4 rounded-xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <MunicipioCombobox
          value={municipioSelecionado}
          onChange={setMunicipioSelecionado}
        />

        {/* Direcao */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Direcao
          </span>
          <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setDirecao("origens")}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: direcao === "origens" ? "var(--primary)" : "var(--bg-card)",
                color: direcao === "origens" ? "var(--primary-fg)" : "var(--fg-secondary)",
              }}
            >
              Origens das vitimas
            </button>
            <button
              type="button"
              onClick={() => setDirecao("destinos")}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: direcao === "destinos" ? "var(--primary)" : "var(--bg-card)",
                color: direcao === "destinos" ? "var(--primary-fg)" : "var(--fg-secondary)",
              }}
            >
              Destinos dos residentes
            </button>
          </div>
        </div>

        {/* Ano */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Ano
          </label>
          <select
            value={ano ?? ""}
            onChange={(e) => setAno(e.target.value ? Number(e.target.value) : undefined)}
            className="h-9 min-w-[110px] rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <option value="">Todos</option>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Veiculo */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Veiculo
          </label>
          <select
            value={tipoVeiculo ?? ""}
            onChange={(e) => setTipoVeiculo(e.target.value || undefined)}
            className="h-9 min-w-[140px] rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Direcao description */}
      {municipioSelecionado && (
        <div
          className="rounded-lg px-4 py-2 text-xs"
          style={{ backgroundColor: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--primary)" }}
        >
          {direcao === "origens" ? (
            <>
              <b>Origens das vitimas:</b> municipio de ocorrencia fixado em{" "}
              <b>{municipioSelecionado.municipio}</b>. As linhas indicam os municipios de residencia das vitimas.
            </>
          ) : (
            <>
              <b>Destinos dos residentes:</b> municipio de residencia fixado em{" "}
              <b>{municipioSelecionado.municipio}</b>. As linhas indicam onde ocorreram os obitos dos seus residentes.
            </>
          )}
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="flex h-16 items-center justify-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Carregando fluxos...
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--deaths-soft)", color: "var(--deaths)", border: "1px solid var(--deaths)" }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      {fluxo && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiStat
            rotulo="Total de obitos"
            valor={formatNumber(fluxo.total_obitos)}
            denominador={`${fluxo.municipio_alvo.municipio} · ${ano ?? "todos os anos"}`}
          />
          <KpiStat
            rotulo="Proprio municipio"
            valor={formatNumber(fluxo.obitos_proprio_municipio)}
            denominador={`${pct(fluxo.total_ambos_encontrados > 0 ? fluxo.obitos_proprio_municipio / fluxo.total_ambos_encontrados : 0)} do total com geo. encontrada`}
          />
          <KpiStat
            rotulo="Outros municipios"
            valor={formatNumber(fluxo.obitos_fora)}
            denominador={`${pct(fluxo.proporcao_fora)} dos obitos com geo. encontrada`}
          />
          <KpiStat
            rotulo="Municipios conectados"
            valor={formatNumber(fluxo.municipios_conectados)}
            denominador="Com pelo menos 1 obito encontrado"
          />
        </div>
      )}

      {/* Map */}
      {fluxo && geoData && !loading && (
        <div
          className="h-[520px] overflow-hidden rounded-xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <FluxoMapView
            geoData={geoData}
            arestas={fluxo.arestas}
            codigoAlvo={codigoAlvo}
            direcao={direcao}
          />
        </div>
      )}

      {/* Table */}
      {fluxo && !loading && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              {direcao === "origens" ? "Municipios de residencia das vitimas" : "Municipios de ocorrencia dos residentes"}
            </h2>
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Top {fluxo.filtros.top_n} por obitos · {fluxo.total_ambos_encontrados} obitos com ambas as geografias encontradas
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
                  {["#", "Municipio", "UF", "Obitos", "Participacao", "Status geo."].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fluxo.arestas.map((edge, i) => (
                  <tr
                    key={edge.cod_mun_ibge}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: edge.propria_municipio ? "var(--primary-soft)" : "transparent",
                    }}
                  >
                    <td className="px-4 py-2.5 text-[11px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--fg)" }}>
                      {edge.municipio}
                      {edge.propria_municipio && (
                        <span
                          className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: "var(--primary)", color: "var(--primary-fg)" }}
                        >
                          Proprio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--fg-secondary)" }}>{edge.uf}</td>
                    <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--fg)" }}>
                      {formatNumber(edge.obitos)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                      {pct(edge.participacao)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: edge.geografia_status === "encontrado" ? "var(--success-soft)" : "var(--deaths-soft)",
                          color: edge.geografia_status === "encontrado" ? "var(--success)" : "var(--deaths)",
                        }}
                      >
                        {edge.geografia_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="px-4 py-2 text-[10px]"
            style={{ backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border)", color: "var(--fg-muted)" }}
          >
            {fluxo.notas_metodologicas}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!municipioSelecionado && !loading && (
        <div
          className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <GitBranch className="h-8 w-8" style={{ color: "var(--fg-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--fg-secondary)" }}>
            Selecione um municipio para visualizar os fluxos
          </p>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Digite o nome ou codigo IBGE no campo acima
          </p>
        </div>
      )}
    </div>
  );
}
