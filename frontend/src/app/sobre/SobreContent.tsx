"use client";

import { useEffect, useState } from "react";
import DiagramaFluxo from "@/components/sobre/DiagramaFluxo";
import { fetchSimMetadata, fetchSimSummary } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  autor,
  cabecalho,
  competencias,
  creditos,
  diagrama,
  indicadoresFallback,
  origens,
  trajetoria,
} from "@/content/sobre";

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

// design/DESIGN_SYSTEM.md §12: rotulo de secao mono caixa-alta, reusado em
// toda a pagina (mesmo papel do .lbl do mockup).
function Rotulo({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="num text-[10.5px] font-semibold uppercase"
      style={{ color: "var(--ink-3)", letterSpacing: "0.13em", ...style }}
    >
      {children}
    </p>
  );
}

function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 ${className ?? ""}`}
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", ...style }}
    >
      {children}
    </div>
  );
}

/**
 * docs/design-system/sobre/ESPEC_PAGINA_SOBRE.md — unica tela do sistema com
 * texto EDITORIAL (nao gerado pelo motor de leitura). Sem BarraDeRecorte: nao
 * ha recorte, e uma pagina institucional.
 *
 * Componente client separado de page.tsx (que fica um Server Component so
 * pra exportar `metadata`) — o <title> do App Router e um no da propria
 * arvore React controlada pelo layout; document.title imperativo aqui dentro
 * seria sobrescrito de volta pelo layout a cada re-render.
 */
export default function SobreContent() {
  const [indicadores, setIndicadores] = useState<Indicadores>(indicadoresFallback);
  const [proveniencia, setProveniencia] = useState<Proveniencia>({ catalogVersion: null, geradoEm: null });

  // Auditoria/espec §4: indicadores ao vivo com fallback fixo — se a API
  // falhar (ou o backend estiver desligado), a pagina fica com o fallback,
  // silenciosamente, sem quebrar numa demonstracao.
  useEffect(() => {
    fetchSimMetadata()
      .then((catalog) => {
        const silver = catalog.datasets.find((d) => d.id === "sim_silver_nacional_v2");
        const linhas = silver?.quality && typeof silver.quality === "object" ? Number((silver.quality as Record<string, unknown>).rows) : NaN;
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

  const temLinks = autor.links.linkedin || autor.links.github || autor.links.lattes;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-11 px-6 lg:px-10">
      {/* ============ CABEÇALHO ============ */}
      <header>
        <Rotulo>{cabecalho.kicker}</Rotulo>
        <h1 className="mt-2 max-w-[28ch] text-[34px] font-semibold leading-[1.15] lg:max-w-none" style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}>
          {cabecalho.titulo}
        </h1>
        <div className="mt-5 max-w-[80ch] pl-5" style={{ borderLeft: "3px solid var(--brand)" }}>
          <p style={{ color: "var(--ink)", fontSize: 19, lineHeight: 1.55 }}>{cabecalho.lede}</p>
        </div>
        <p className="mt-4 max-w-[80ch] text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
          {cabecalho.notaEditorial}
        </p>
      </header>

      {/* ============ 01 · DE ONDE VEIO ============ */}
      <section>
        <Rotulo>01 · De onde veio</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          Três origens, um problema
        </h2>
        <p className="mb-4 mt-1 max-w-[78ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
          Nenhuma das três, sozinha, teria produzido este trabalho.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {origens.map((origem) => (
            <Card key={origem.rotulo}>
              <Rotulo style={{ color: `var(${origem.corVar})` }}>{origem.rotulo}</Rotulo>
              <h3 className="mt-2 text-base font-semibold" style={{ color: "var(--ink)" }}>
                {origem.titulo}
              </h3>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
                {origem.texto}
              </p>
              <p
                className="mt-3 pt-3 text-[13px]"
                style={{ color: "var(--ink-2)", lineHeight: 1.55, borderTop: "1px dotted var(--border)" }}
              >
                <strong style={{ color: "var(--ink)" }}>O que isso aportou:</strong> {origem.oQueAportou}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ============ 02 · TRAJETÓRIA ============ */}
      <section>
        <Rotulo>02 · Trajetória</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          O caminho até aqui
        </h2>

        {/* >= 640px: linha horizontal ligando os pontos */}
        <div className="mt-5 overflow-x-auto">
        <div className="hidden min-w-[640px] sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-0">
          {trajetoria.map((marco, indice) => (
            <div key={marco.kicker} className="relative pr-4">
              {indice < trajetoria.length - 1 && (
                <span
                  className="absolute hidden lg:block"
                  style={{ top: 4.5, left: 11, right: 0, height: 1, backgroundColor: "var(--border)" }}
                />
              )}
              <span
                className="relative z-[1] mb-3.5 block h-[11px] w-[11px] rounded-full"
                style={{
                  backgroundColor: marco.atual ? "var(--brand)" : "var(--surface)",
                  border: "2px solid var(--brand)",
                }}
              />
              <p className="num text-[11px]" style={{ color: marco.atual ? "var(--brand)" : "var(--ink-3)" }}>
                {marco.kicker}
                {marco.periodo ? ` · ${marco.periodo}` : ""}
              </p>
              <p className="mt-1 text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>
                {marco.titulo}
              </p>
              <p className="mt-1 pr-3 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
                {marco.texto}
              </p>
            </div>
          ))}
        </div>
        </div>

        {/* < 640px: linha vertical, regua pela esquerda */}
        <div className="mt-5 flex flex-col gap-6 sm:hidden">
          {trajetoria.map((marco, indice) => (
            <div key={marco.kicker} className="relative pl-6">
              {indice < trajetoria.length - 1 && (
                <span className="absolute" style={{ top: 11, bottom: -24, left: 5, width: 1, backgroundColor: "var(--border)" }} />
              )}
              <span
                className="absolute left-0 top-1 block h-[11px] w-[11px] rounded-full"
                style={{
                  backgroundColor: marco.atual ? "var(--brand)" : "var(--surface)",
                  border: "2px solid var(--brand)",
                }}
              />
              <p className="num text-[11px]" style={{ color: marco.atual ? "var(--brand)" : "var(--ink-3)" }}>
                {marco.kicker}
                {marco.periodo ? ` · ${marco.periodo}` : ""}
              </p>
              <p className="mt-1 text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>
                {marco.titulo}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
                {marco.texto}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 03 · COMO FUNCIONA ============ */}
      <section>
        <Rotulo>03 · Como funciona</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          O caminho do dado, em uma vista
        </h2>
        <p className="mb-4 mt-1 max-w-[80ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
          {diagrama.introducao}
        </p>
        <Card style={{ padding: "26px 22px" }}>
          <DiagramaFluxo />
        </Card>
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Cobertura</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>
              {formatNumber(indicadores.linhasSilver)}
            </p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>linhas na camada Silver — Brasil inteiro</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Catálogo</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>
              {formatNumber(indicadores.datasets)}
            </p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>datasets versionados e validados</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Período</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>{indicadores.periodo}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>série consolidada do SIM</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Recorte</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>{indicadores.recorteCid}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>acidentes de transporte terrestre</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <Rotulo>Validação</Rotulo>
            <p className="num mt-1.5 text-xl font-semibold" style={{ color: "var(--ok)" }}>{indicadores.validacaoOnsv}</p>
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>concordância com a base da ONSV</p>
          </div>
        </div>
      </section>

      {/* ============ 04 · AUTOR ============ */}
      <section>
        <Rotulo>04 · Autor</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          Quem construiu
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="flex items-start gap-5">
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--sunken)", border: autor.foto ? "1px solid var(--border)" : "1px dashed var(--hairline)" }}
              >
                {autor.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={autor.foto} alt={autor.nome} className="h-full w-full object-cover" />
                ) : (
                  <span className="num text-lg font-semibold" style={{ color: "var(--ink-3)" }}>{autor.iniciais}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>{autor.nome}</h3>
                {autor.cargoAtual && (
                  <p className="num mt-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>{autor.cargoAtual}</p>
                )}
                <p className="mt-3 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{autor.resumo}</p>
                {temLinks && (
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {autor.links.linkedin && (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]"
                        style={{ border: "1px solid var(--border)", color: "var(--brand)" }}
                        href={autor.links.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`LinkedIn de ${autor.nome} (abre em nova aba)`}
                      >
                        LinkedIn
                      </a>
                    )}
                    {autor.links.github && (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]"
                        style={{ border: "1px solid var(--border)", color: "var(--brand)" }}
                        href={autor.links.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`GitHub de ${autor.nome} (abre em nova aba)`}
                      >
                        GitHub
                      </a>
                    )}
                    {autor.links.lattes && (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]"
                        style={{ border: "1px solid var(--border)", color: "var(--brand)" }}
                        href={autor.links.lattes}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Currículo Lattes de ${autor.nome} (abre em nova aba)`}
                      >
                        Lattes
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <Rotulo>Formação</Rotulo>
              <div className="mt-2.5 space-y-3">
                {autor.formacao.map((item) => (
                  <div key={item.titulo}>
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{item.titulo}</p>
                    <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>{item.texto}</p>
                  </div>
                ))}
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {autor.residencia.titulo}
                    {autor.residencia.nomePrograma ? ` — ${autor.residencia.nomePrograma}` : ""}
                  </p>
                  <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                    {autor.residencia.texto}
                    {autor.sasiSignificado ? ` (${autor.sasiSignificado})` : ""}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ backgroundColor: "var(--sunken)" }}>
            <Rotulo>{autor.convergencia.rotulo}</Rotulo>
            <p className="mt-3 text-[15.5px]" style={{ color: "var(--ink)", lineHeight: 1.6 }}>
              Um trabalho sobre <strong>mortalidade no trânsito</strong> registrada no <strong>sistema de saúde</strong> não é
              uma escolha aleatória de tema. É o único assunto em que os dois lados da minha experiência profissional
              respondem à mesma pergunta.
            </p>
            <p className="mt-3.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
              {autor.convergencia.paragrafo2}
            </p>
          </Card>
        </div>
      </section>

      {/* ============ 05 · COMPETÊNCIAS ============ */}
      <section>
        <Rotulo>05 · Competências aplicadas neste trabalho</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          O que foi preciso saber
        </h2>
        <p className="mb-4 mt-1 max-w-[80ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
          Cada bloco abaixo corresponde a decisões concretas tomadas neste sistema — não a uma lista de tecnologias.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competencias.map((bloco) => (
            <Card key={bloco.titulo}>
              <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{bloco.titulo}</h3>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{bloco.texto}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {bloco.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 text-[11.5px]"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--sunken)", color: "var(--ink-2)", paddingTop: 2, paddingBottom: 2 }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ============ 06 · CRÉDITOS ============ */}
      <section>
        <Rotulo>06 · Créditos e transparência</Rotulo>
        <h2 className="mt-1 text-[22px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.012em" }}>
          Como citar e o que usar
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <Rotulo>Trabalho acadêmico</Rotulo>
            <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{creditos.referenciaAbnt}</p>
            <p
              className="mt-3.5 pt-3 text-[13px]"
              style={{ color: "var(--ink-2)", lineHeight: 1.55, borderTop: "1px dotted var(--border)" }}
            >
              <strong style={{ color: "var(--ink)" }}>Ao citar uma figura</strong>, {creditos.notaCitacao.replace(/^Ao citar uma figura, /, "")}
            </p>
          </Card>
          <Card>
            <Rotulo>Fontes e licenças</Rotulo>
            <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{creditos.fontesTexto1}</p>
            <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{creditos.fontesTexto2}</p>
            {creditos.licenca && (
              <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{creditos.licenca}</p>
            )}
          </Card>
        </div>
      </section>

      <footer className="num pt-4 text-[9.5px]" style={{ borderTop: "1px solid var(--border)", color: "var(--ink-3)", lineHeight: 1.8 }}>
        Sobre o projeto · texto editorial, escrito pelo autor · não gerado pelo motor de leitura
        <br />
        Sistema V01–V89{proveniencia.catalogVersion ? ` · versão do catálogo ${proveniencia.catalogVersion}` : ""}
        {geradoEmFormatado ? ` · última extração ${geradoEmFormatado}` : ""}
        <br />
        IFBA — Campus Vitória da Conquista · 2026
      </footer>
    </div>
  );
}
