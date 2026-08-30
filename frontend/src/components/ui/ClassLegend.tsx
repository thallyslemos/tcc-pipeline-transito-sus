import { formatTaxa100k } from "@/lib/format";
import { BREAKS, rampaClasses } from "@/lib/theme/mapaClasses";

interface Props {
  isDark: boolean;
}

function rotuloClasse(indice: number): string {
  const inferior = indice === 0 ? null : BREAKS[indice - 1];
  const superior = indice < BREAKS.length ? BREAKS[indice] : null;
  if (inferior == null) return `< ${formatTaxa100k(superior!)}`;
  if (superior == null) return `≥ ${formatTaxa100k(inferior)}`;
  return `${formatTaxa100k(inferior)} – ${formatTaxa100k(superior)}`;
}

/**
 * design/DESIGN_SYSTEM.md §5.5 e §8 — 5 caixas com os limites numericos das
 * classes FIXAS (nunca um gradiente continuo sem rotulo — "gradiente sem
 * numero nao e legenda, e decoracao"), mais a caixa hachurada de "sem dado".
 * So usada pra escala de taxa por 100 mil ("relative") — a unica com
 * quintis validados; contagem absoluta e taxa veicular continuam com
 * <MapLegend/> (escala relativa ao recorte, ver MapView.tsx).
 */
export default function ClassLegend({ isDark }: Props) {
  const cores = rampaClasses(isDark);
  return (
    <div
      className="flex min-w-[220px] flex-col gap-1.5 rounded-md px-3 py-2"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span
        className="num text-[10px] font-semibold uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
      >
        Óbitos / 100 mil hab.
      </span>
      <div className="flex flex-col gap-1">
        {cores.map((cor, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <span className="h-3 w-5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
            <span className="num text-[10px]" style={{ color: "var(--ink-2)" }}>
              {rotuloClasse(indice)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="h-3 w-5 shrink-0 rounded-sm" style={{ background: "var(--hatch-nd)" }} />
          <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>
            Sem dado
          </span>
        </div>
      </div>
    </div>
  );
}
