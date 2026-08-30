/**
 * docs/design-system/sobre/ESPEC_PAGINA_SOBRE.md — SVG inline, não Mermaid:
 * Mermaid renderiza em runtime (~500 KB de bundle pra uma figura estática) e
 * não lê variável CSS, então não acompanharia o tema claro/escuro sem
 * gambiarra. Este SVG usa var(--risk-1|2|5), var(--brand), var(--hairline)
 * etc. direto e herda o tema de graça. Copiado do mockup
 * (docs/design-system/sobre/sobre-mockup.html), viewBox 0 0 1080 300.
 *
 * A fonte Mermaid equivalente, so pra documentacao do repo, fica registrada
 * em docs/design-system/sobre/ESPEC_PAGINA_SOBRE.md — nao gerada aqui.
 */
export default function DiagramaFluxo() {
  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox="0 0 1080 300"
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label="Fluxo de dados: fontes públicas, ingestão, camadas Bronze, Silver e Gold, API e interface, com catálogo de proveniência acompanhando todas as etapas"
      >
        <defs>
          <marker id="sobre-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--hairline)" />
          </marker>
          <marker id="sobre-ahb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--brand)" />
          </marker>
        </defs>

        {/* fontes */}
        <text x="18" y="26" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--ink-3)" letterSpacing="1.3">
          FONTES PÚBLICAS
        </text>
        <g>
          <rect x="18" y="42" width="150" height="42" rx="5" fill="var(--surface)" stroke="var(--flow-origin)" strokeWidth="1.4" />
          <text x="34" y="61" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--ink)">SIM / DATASUS</text>
          <text x="34" y="76" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">microdados de óbito</text>

          <rect x="18" y="96" width="150" height="42" rx="5" fill="var(--surface)" stroke="var(--flow-origin)" strokeWidth="1.4" />
          <text x="34" y="115" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--ink)">IBGE</text>
          <text x="34" y="130" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">população e malhas</text>

          <rect x="18" y="150" width="150" height="42" rx="5" fill="var(--surface)" stroke="var(--flow-origin)" strokeWidth="1.4" />
          <text x="34" y="169" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--ink)">SENATRAN</text>
          <text x="34" y="184" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">frota por município</text>
        </g>

        {/* conectores fontes -> bronze */}
        <path d="M168 63 C196 63 196 117 214 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" />
        <path d="M168 117 L214 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" />
        <path d="M168 171 C196 171 196 117 214 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" />
        <path d="M214 117 L246 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" markerEnd="url(#sobre-ah)" />

        {/* camadas */}
        <text x="256" y="26" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--ink-3)" letterSpacing="1.3">
          CAMADAS
        </text>
        <g>
          <rect x="256" y="88" width="152" height="58" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <circle cx="274" cy="106" r="5" fill="var(--risk-1)" stroke="var(--hairline)" strokeWidth="0.8" />
          <text x="288" y="110" fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="600" fill="var(--ink)" letterSpacing="1">BRONZE</text>
          <text x="272" y="130" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">arquivo original,</text>
          <text x="272" y="142" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">preservado sem alteração</text>

          <rect x="428" y="88" width="152" height="58" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <circle cx="446" cy="106" r="5" fill="var(--risk-2)" stroke="var(--hairline)" strokeWidth="0.8" />
          <text x="460" y="110" fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="600" fill="var(--ink)" letterSpacing="1">SILVER</text>
          <text x="444" y="130" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">uma linha por óbito,</text>
          <text x="444" y="142" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">tipado e com QA aplicado</text>

          <rect x="600" y="88" width="152" height="58" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <circle cx="618" cy="106" r="5" fill="var(--risk-5)" stroke="var(--hairline)" strokeWidth="0.8" />
          <text x="632" y="110" fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="600" fill="var(--ink)" letterSpacing="1">GOLD</text>
          <text x="616" y="130" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">agregados por município,</text>
          <text x="616" y="142" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">mês e modal</text>
        </g>
        <path d="M408 117 L426 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" markerEnd="url(#sobre-ah)" />
        <path d="M580 117 L598 117" fill="none" stroke="var(--hairline)" strokeWidth="1.3" markerEnd="url(#sobre-ah)" />
        <path d="M752 117 L796 117" fill="none" stroke="var(--hairline)" strokeWidth="1.6" markerEnd="url(#sobre-ah)" />

        {/* entrega */}
        <text x="800" y="26" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--ink-3)" letterSpacing="1.3">
          ENTREGA
        </text>
        <rect x="800" y="60" width="262" height="114" rx="5" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.3" />
        <text x="818" y="83" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--ink)">API + interface analítica</text>
        <text x="818" y="103" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">— taxa com denominador à vista</text>
        <text x="818" y="120" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">— leitura gerada, com a regra nomeada</text>
        <text x="818" y="137" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">— guardas contra recorte enganoso</text>
        <text x="818" y="154" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">— figura e recorte citáveis por URL</text>

        {/* catalogo / proveniencia */}
        <rect x="256" y="216" width="496" height="46" rx="5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.3" strokeDasharray="5 4" />
        <text x="272" y="237" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="600" fill="var(--ink)">Catálogo versionado</text>
        <text x="272" y="252" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--ink-2)">SHA-256 · contagem de linhas · data de extração · status de validação</text>
        <path d="M332 216 L332 148" fill="none" stroke="var(--brand)" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#sobre-ahb)" />
        <path d="M504 216 L504 148" fill="none" stroke="var(--brand)" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#sobre-ahb)" />
        <path d="M676 216 L676 148" fill="none" stroke="var(--brand)" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#sobre-ahb)" />
        <path d="M752 239 L900 239 L900 176" fill="none" stroke="var(--brand)" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#sobre-ahb)" />
      </svg>
    </div>
  );
}
