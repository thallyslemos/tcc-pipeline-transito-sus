import { formatNumber, formatPercentual } from "@/lib/format";

export interface RankedBarItem {
  nome: string;
  valor: number;
}

interface Props {
  itens: RankedBarItem[];
  /**
   * Cor de DADO por item (ex.: paleta categorica de tipo de vitima,
   * --cat-*). Quando ausente, todas as barras ficam em --hairline —
   * neutro, sem distincao de cor entre categorias (design/DESIGN_SYSTEM.md
   * §3.3: a paleta categorica so existe para tipo de vitima, nao se
   * estende a outras dimensoes como sexo).
   */
  corPorItem?: (nome: string) => string;
  /**
   * "lider" (padrao): so a barra de maior valor recebe a cor de
   * corPorItem, as demais ficam em --hairline. "todas": cada barra recebe
   * sua propria cor — use so quando a comparacao ENTRE categorias for o
   * assunto da tela (§5.3).
   */
  enfase?: "lider" | "todas";
}

/**
 * design/DESIGN_SYSTEM.md §5.3 — substitui <PieChart> de ate 9 fatias.
 * Barras horizontais ordenadas por valor decrescente, percentual em mono
 * a direita. PieChart continua permitida com <=4 categorias (nao e este
 * componente que decide isso — quem chama decide se usa RankedBar ou
 * PieChart).
 */
export default function RankedBar({ itens, corPorItem, enfase = "lider" }: Props) {
  const ordenado = [...itens].sort((a, b) => b.valor - a.valor);
  const total = ordenado.reduce((soma, item) => soma + item.valor, 0);

  return (
    <div className="space-y-2.5">
      {ordenado.map((item, index) => {
        const pct = total === 0 ? 0 : (item.valor / total) * 100;
        const cor = corPorItem && (enfase === "todas" || index === 0) ? corPorItem(item.nome) : "var(--hairline)";
        return (
          <div key={item.nome} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[12px]" style={{ color: "var(--ink-2)" }}>
              {item.nome}
            </span>
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: "var(--surface)" }}>
              <div className="h-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
            </div>
            <span className="num w-12 shrink-0 text-right text-[12px]" style={{ color: "var(--ink-2)" }}>
              {formatPercentual(pct)}%
            </span>
            <span className="num w-14 shrink-0 text-right text-[12px]" style={{ color: "var(--ink)" }}>
              {formatNumber(item.valor)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
