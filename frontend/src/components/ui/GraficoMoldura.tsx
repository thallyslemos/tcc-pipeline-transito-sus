import type { ReactNode } from "react";
import InfoTip from "@/components/InfoTip";
import type { TermoAjuda } from "@/content/ajuda";
import { medidas, type MedidaId } from "@/content/medidas";
import { metodo } from "@/content/metodo";
import type { Leitura } from "@/lib/leitura";

interface Props {
  medidaId: MedidaId;
  children: ReactNode;
  /** Legenda em DOM — nunca a <Legend/> do Recharts (precisa ser o mesmo texto que vai pra figura exportada). */
  legenda?: ReactNode;
  /** Camada 3: saida de gerarLeitura(). null/undefined = nenhuma leitura disponivel pro recorte atual. */
  leitura?: Leitura | null;
  /** "fonte · recorte · extracao · versao". */
  proveniencia?: string;
  /** Alimenta o botao [?] (variante="colchete" do InfoTip); omitido quando nao ha termo de ajuda cadastrado ainda. */
  termoAjuda?: TermoAjuda;
  className?: string;
}

/**
 * design/DESIGN_SYSTEM.md §5.4 — envelope obrigatorio de todo grafico da
 * aplicacao, substitui components/charts/ChartCard.tsx. Camada 1 (titulo de
 * medida) e Camada 2 (nota de metodo) sao fixas, vem de content/medidas.ts
 * e content/metodo.ts; Camada 3 (leitura do recorte) e gerada pelo motor em
 * lib/leitura e SEMPRE se identifica como gerada, citando a regra.
 */
export default function GraficoMoldura({
  medidaId,
  children,
  legenda,
  leitura,
  proveniencia,
  termoAjuda,
  className,
}: Props) {
  return (
    <div
      className={`rounded-md p-4 ${className ?? ""}`}
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
          {medidas[medidaId]}
        </h3>
        {termoAjuda && <InfoTip termo={termoAjuda} variante="colchete" />}
      </div>
      <p className="mb-3 text-[13px]" style={{ color: "var(--ink-2)" }}>
        {metodo[medidaId]}
      </p>

      {children}

      {legenda && <div className="mt-2">{legenda}</div>}

      {leitura && (
        <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[13px]" style={{ color: "var(--ink)" }}>
            {leitura.texto}{" "}
            <span className="num text-[11px]" style={{ color: "var(--ink-3)" }}>
              {leitura.gerado ? `gerado · regra ${leitura.regra}` : `suprimido · guarda ${leitura.regra}`}
            </span>
          </p>
        </div>
      )}

      {proveniencia && (
        <p className="num mt-2 text-[11px]" style={{ color: "var(--ink-3)" }}>
          {proveniencia}
        </p>
      )}
    </div>
  );
}
