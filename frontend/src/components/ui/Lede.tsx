import type { Leitura } from "@/lib/leitura";

interface Props {
  rotulo: string;
  /** Saida de gerarLeitura(). null = nenhuma guarda nem regra se aplicou ao recorte atual. */
  leitura: Leitura | null;
}

/**
 * design/DESIGN_SYSTEM.md §5.1 — paragrafo que responde a pergunta da tela,
 * um por tela, no topo, nunca dois. Regua vertical 3px em --risk-5, rotulo
 * mono acima, identifica a regra que produziu o texto. Se nenhuma regra
 * passou, o componente diz que suprimiu a leitura e explica por que — nunca
 * fica em branco.
 */
export default function Lede({ rotulo, leitura }: Props) {
  const texto = leitura?.texto ?? "Sem leitura automática disponível para este recorte.";
  const meta = leitura
    ? leitura.gerado
      ? `gerado · regra ${leitura.regra}`
      : `suprimido · guarda ${leitura.regra}`
    : "nenhuma regra aplicável a este recorte";

  return (
    <div className="pl-3" style={{ borderLeft: "3px solid var(--risk-5)" }}>
      <p
        className="num text-[11px] font-medium uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
      >
        {rotulo}
      </p>
      <p className="mt-1" style={{ color: "var(--ink)", fontSize: 21, lineHeight: 1.5, maxWidth: "82ch" }}>
        {texto}
      </p>
      <p className="num mt-1 text-[11px]" style={{ color: "var(--ink-3)" }}>
        {meta}
      </p>
    </div>
  );
}
