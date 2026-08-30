import InfoTip from "@/components/InfoTip";
import type { TermoAjuda } from "@/content/ajuda";
import { formatPercentual } from "@/lib/format";

interface Delta {
  valor: number;
  /** referencia explicita do delta, ex.: "vs 2018" (design/DESIGN_SYSTEM.md §5.2). */
  referencia: string;
}

interface Props {
  rotulo: string;
  /** valor ja formatado (mono tabular via a classe .num). */
  valor: string;
  unidade?: string;
  delta?: Delta;
  /**
   * Nota abaixo do valor. Quando `valor` e uma taxa, ESTE CAMPO E O
   * DENOMINADOR e nao e opcional na pratica (§5.2: "o denominador nao e
   * opcional. '20,3 /100 mil' sem 'Populacao IBGE 2024 · 14.850.513 hab. ·
   * tabela 6579' logo abaixo e um numero nao auditavel") — o tipo continua
   * `?` porque nem todo KpiStat representa uma taxa; nesses casos serve
   * como legenda contextual generica (ex.: "com registro", municipio/UF).
   */
  denominador?: string;
  termoAjuda?: TermoAjuda;
}

/**
 * design/DESIGN_SYSTEM.md §5.2 — substitui components/charts/KpiCard.tsx.
 * Estrutura fixa: rotulo -> valor -> unidade -> delta -> denominador.
 * Sem icone colorido dentro (compete com o valor) e sem sparkline (fora do
 * contrato do §5.2 — decisao tomada ao planejar esta fase).
 */
export default function KpiStat({ rotulo, valor, unidade, delta, denominador, termoAjuda }: Props) {
  return (
    <div
      className="relative rounded-md p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="num text-[11px] font-medium uppercase"
          style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
        >
          {rotulo}
        </p>
        {termoAjuda && <InfoTip termo={termoAjuda} />}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="num text-[34px] font-medium leading-none" style={{ color: "var(--ink)" }}>
          {valor}
        </span>
        {unidade && (
          <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            {unidade}
          </span>
        )}
      </div>

      {delta && (
        <p className="num mt-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
          {delta.valor >= 0 ? "▲" : "▼"} {formatPercentual(Math.abs(delta.valor))}% {delta.referencia}
        </p>
      )}

      {denominador && (
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
          {denominador}
        </p>
      )}
    </div>
  );
}
