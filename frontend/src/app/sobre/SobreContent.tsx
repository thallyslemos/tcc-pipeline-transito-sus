"use client";

import { useEffect, useState } from "react";
import DiagramaFluxo from "@/components/sobre/DiagramaFluxo";
import { fetchSimMetadata, fetchSimSummary } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { autor, cabecalho, creditos, diagrama, indicadoresFallback, projeto } from "@/content/sobre";

interface Indicadores {
  linhasSilver: number;
  datasets: number;
  periodo: string;
  recorteCid: string;
  validacaoOnsv: string;
}

interface Proveniencia {
  catalogVersion: string | null;
  geradoEm: string | null;
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="num text-[10.5px] font-semibold uppercase"
      style={{ color: "var(--ink-3)", letterSpacing: "0.13em" }}
    >
      {children}
    </p>
  );
}

function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${className ?? ""}`}
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", ...style }}
    >
      {children}
    </div>
  );
}

export default function SobreContent() {
  const [indicadores, setIndicadores] = useState<Indicadores>(indicadoresFallback);
  const [proveniencia, setProveniencia] = useState<Proveniencia>({
    catalogVersion: null,
    geradoEm: null,
  });

  useEffect(() => {
    fetchSimMetadata()
      .then((catalog) => {
        const silver = catalog.datasets.find((d) => d.id === "sim_silver_nacional_v2");
        const linhas =
          silver?.quality && typeof silver.quality === "object"
            ? Number((silver.quality as Record<string, unknown>).rows)
            : NaN;
        setIndicadores((atual) => ({
          ...atual,
          linhasSilver: Number.isFinite(linhas) ? linhas : atual.linhasSilver,
          datasets: catalog.datasets.length || atual.datasets,
        }));
        setProveniencia({ catalogVersion: catalog.catalog_version, geradoEm: catalog.generated_at });
      })
      .catch(() => {});
    fetchSimSummary({})
      .then((summary) => {
        if (summary.periodo) setIndicadores((atual) => ({ ...atual, periodo: summary.periodo.replace("-", "–") }));
      })
      .catch(() => {});
  }, []);

  const geradoEmFormatado = proveniencia.geradoEm
    ? new Date(proveniencia.geradoEm).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 lg:px-10">
      <header>
        <Rotulo>{cabecalho.kicker}</Rotulo>
        <h1
          className="mt-2 max-w-[32ch] text-[30px] font-semibold leading-[1.2] lg:max-w-none lg:text-[34px]"
          style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}
        >
          {cabecalho.titulo}
        </h1>
        <p className="mt-4 max-w-[78ch] text-[15px]" style={{ color: "var(--ink)", lineHeight: 1.6 }}>
          {cabecalho.lede}
        </p>
        <p className="mt-3 max-w-[78ch] text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
          {cabecalho.notaEditorial}
        </p>
      </header>

      <section>
        <Rotulo>01 · Escopo</Rotulo>
        <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--ink)" }}>
          {projeto.titulo}
        </h2>
        <div className="mt-3 max-w-[78ch] space-y-3 text-[14px]" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
          {projeto.paragrafos.map((paragrafo) => (
            <p key={paragrafo.slice(0, 40)}>{paragrafo}</p>
          ))}
        </div>
        <p className="mt-4 text-[13px]" style={{ color: "var(--ink-3)" }}>
          Recorte CID-10: {indicadores.recorteCid} · período consolidado: {indicadores.periodo}
          {proveniencia.catalogVersion ? ` · catálogo ${proveniencia.catalogVersion}` : ""}
        </p>
      </section>

      <section>
        <Rotulo>02 · {diagrama.titulo}</Rotulo>
        <p className="mt-1 max-w-[78ch] text-[14px]" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
          {diagrama.introducao}
        </p>
        <Card className="mt-4" style={{ padding: "26px 22px" }}>
          <DiagramaFluxo />
        </Card>
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Cobertura</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>
              {formatNumber(indicadores.linhasSilver)}
            </p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>linhas na Silver</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Catálogo</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>
              {formatNumber(indicadores.datasets)}
            </p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>datasets versionados</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Período</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>{indicadores.periodo}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>série consolidada</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Recorte</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>{indicadores.recorteCid}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>transporte terrestre</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Validação</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ok)" }}>{indicadores.validacaoOnsv}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>concordância ONSV</p>
          </div>
        </div>
      </section>

      <section>
        <Rotulo>03 · Autor</Rotulo>
        <Card className="max-w-xl">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--sunken)", border: "1px dashed var(--hairline)" }}
            >
              <span className="num text-base font-semibold" style={{ color: "var(--ink-3)" }}>
                {autor.iniciais}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {autor.nome}
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
                {autor.formacao}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={autor.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-1.5 text-[13px]"
                  style={{ border: "1px solid var(--border)", color: "var(--brand)" }}
                >
                  LinkedIn
                </a>
                <a
                  href={autor.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-1.5 text-[13px]"
                  style={{ border: "1px solid var(--border)", color: "var(--brand)" }}
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Rotulo>04 · Créditos</Rotulo>
        <Card className="max-w-3xl">
          <p className="text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            {creditos.referenciaAbnt}
          </p>
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            {creditos.notaCitacao}
          </p>
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            {creditos.fontes}
          </p>
        </Card>
      </section>

      <footer
        className="num pt-4 text-[9.5px]"
        style={{ borderTop: "1px solid var(--border)", color: "var(--ink-3)", lineHeight: 1.8 }}
      >
        Texto editorial · não gerado pelo motor de leitura
        {geradoEmFormatado ? ` · última extração ${geradoEmFormatado}` : ""}
        <br />
        IFBA — Campus Vitória da Conquista · 2026
      </footer>
    </div>
  );
}
