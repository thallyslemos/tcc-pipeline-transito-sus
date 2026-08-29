"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchSimMetadata,
  fetchSimMunicipios,
  fetchSimPopulacaoCobertura,
  fetchSimPrelimMetadata,
} from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { SimCatalog, SimMunicipio, SimPopulacaoCobertura, SimPrelimMetadata } from "@/lib/types";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  validated: { bg: "var(--ok-soft)", fg: "var(--ok)" },
  partial: { bg: "var(--attention-soft)", fg: "var(--attention)" },
  preliminary: { bg: "var(--attention-soft)", fg: "var(--attention)" },
};

export default function DadosPage() {
  const [catalog, setCatalog] = useState<SimCatalog | null>(null);
  const [prelimCatalog, setPrelimCatalog] = useState<SimPrelimMetadata | null>(null);
  const [rows, setRows] = useState<SimMunicipio[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dimensao, setDimensao] = useState<"ocorrencia" | "residencia">("ocorrencia");
  const [popCobertura, setPopCobertura] = useState<SimPopulacaoCobertura | null>(null);

  useEffect(() => {
    fetchSimMetadata().then(setCatalog);
    fetchSimPrelimMetadata().then(setPrelimCatalog).catch(() => setPrelimCatalog(null));
  }, []);

  useEffect(() => {
    fetchSimMunicipios({ dimensao, municipio: search }, page, 25).then((result) => {
      setRows(result.municipios);
      setTotal(result.total);
    });
  }, [dimensao, page, search]);

  useEffect(() => {
    fetchSimPopulacaoCobertura({ dimensao }).then(setPopCobertura).catch(() => setPopCobertura(null));
  }, [dimensao]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          Dados e metadados
        </h1>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          Fontes, cobertura, grao, hashes e consulta paginada dos marts SIM.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {catalog?.datasets.map((dataset) => (
          <article
            key={dataset.id}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {dataset.id}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  backgroundColor: (STATUS_STYLE[dataset.status] ?? STATUS_STYLE.partial).bg,
                  color: "var(--ink-2)",
                }}
              >
                {dataset.status}
              </span>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>
              {dataset.provider} - {dataset.grain ?? "sem grao informado"}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
              Linhas: {dataset.quality?.rows == null ? "N/D" : formatNumber(Number(dataset.quality.rows))} -{" "}
              {dataset.sha256 ? `SHA-256 ${dataset.sha256.slice(0, 12)}...` : "hash nao informado"}
            </p>
          </article>
        ))}
        {prelimCatalog?.datasets.map((dataset) => (
          <article
            key={dataset.id}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface)", border: `1px solid var(--attention)` }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {dataset.id}
                <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--attention)" }} />
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ backgroundColor: "var(--attention-soft)", color: "var(--attention)" }}
              >
                preliminary
              </span>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>
              {dataset.available ? (dataset.provider ?? "DATASUS/SIM (PRELIM/DORES)") : "Ainda nao ingerido"} -{" "}
              {dataset.grain ?? "sem grao informado"}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
              {dataset.available
                ? `Obitos: ${formatNumber(dataset.quality?.total_obitos ?? 0)} - extraido ate ${dataset.data_extracao_max ?? "N/D"}`
                : "Rode data-pipeline/run.py --prelim para popular"}
            </p>
          </article>
        ))}
      </div>

      <section
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Cobertura do denominador populacional (IBGE)
        </h2>
        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
          O artefato local de populacao IBGE nao cobre todos os anos para todos os municipios. Quando a
          populacao exata (mesmo municipio e ano) nao existe, a taxa por 100 mil usa a populacao do ano IBGE
          mais proximo do mesmo municipio (nunca interpolada ou projetada) e e marcada como estimada em toda
          a interface. Esta contagem cobre o Brasil inteiro, dimensao {dimensao}, todos os anos.
        </p>
        {popCobertura && popCobertura.total_municipio_ano > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--ok-soft)" }}>
              <p className="text-lg font-bold" style={{ color: "var(--ok)" }}>
                {formatNumber(popCobertura.exata)}
              </p>
              <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                Exata ({((popCobertura.exata / popCobertura.total_municipio_ano) * 100).toFixed(1)}%)
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--attention-soft)" }}>
              <p className="text-lg font-bold" style={{ color: "var(--attention)" }}>
                {formatNumber(popCobertura.estimada)}
              </p>
              <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                Estimada ({((popCobertura.estimada / popCobertura.total_municipio_ano) * 100).toFixed(1)}%)
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--sunken)" }}>
              <p className="text-lg font-bold" style={{ color: "var(--ink-2)" }}>
                {formatNumber(popCobertura.indisponivel)}
              </p>
              <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                Indisponivel (N/D) ({((popCobertura.indisponivel / popCobertura.total_municipio_ano) * 100).toFixed(1)}%)
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs" style={{ color: "var(--ink-2)" }}>
            Carregando cobertura...
          </p>
        )}
        <p className="mt-2 text-[10px]" style={{ color: "var(--ink-2)" }}>
          {formatNumber(popCobertura?.total_municipio_ano ?? 0)} pares municipio-ano no total. Base: municipios
          com geografia encontrada no mart SIM-only.
        </p>
      </section>

      <section
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Dimensao"
            value={dimensao}
            onChange={(event) => {
              setDimensao(event.target.value as "ocorrencia" | "residencia");
              setPage(1);
            }}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
          >
            <option value="ocorrencia">Ocorrencia</option>
            <option value="residencia">Residencia</option>
          </select>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar municipio ou codigo"
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--canvas)", color: "var(--ink)", border: "1px solid var(--border)" }}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--sunken)" }}>
              <tr className="text-xs" style={{ color: "var(--ink-2)" }}>
                <th className="px-3 py-2 text-left">Codigo</th>
                <th className="px-3 py-2 text-left">Municipio</th>
                <th className="px-3 py-2 text-left">UF</th>
                <th className="px-3 py-2 text-right">Obitos</th>
                <th className="px-3 py-2 text-right">Taxa / 100 mil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cod_mun_ibge} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-2 font-mono text-xs">{row.cod_mun_ibge}</td>
                  <td className="px-3 py-2">{row.municipio}</td>
                  <td className="px-3 py-2">{row.uf}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.obitos)}</td>
                  <td className="px-3 py-2 text-right">
                    {row.taxa_obitos_100mil == null ? "N/D" : row.taxa_obitos_100mil.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--ink-2)" }}>
          <span>
            {total ? `${(page - 1) * 25 + 1}-${Math.min(page * 25, total)} de ${total}` : "Sem dados"}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded px-2 py-1 disabled:opacity-30"
              style={{ border: "1px solid var(--border)" }}
            >
              Anterior
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              className="rounded px-2 py-1 disabled:opacity-30"
              style={{ border: "1px solid var(--border)" }}
            >
              Proxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
