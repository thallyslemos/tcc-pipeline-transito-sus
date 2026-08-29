/**
 * Motor de leitura (design/DESIGN_SYSTEM.md §6.2): 3 regras + 2 guardas,
 * cada uma uma funcao pura (dados) => Leitura | null. Guardas tem
 * precedencia sobre regras (ver index.ts). Nunca formatam numero cru —
 * sempre via src/lib/format.ts.
 */

export interface PontoSerieAnual {
  /** rotulo do periodo ja formatado para exibicao, ex.: "2010" ou "2024-01" */
  periodo: string;
  valor: number;
}

export interface MunicipioContagem {
  municipio: string;
  obitos: number;
}

export interface MunicipioTaxa {
  municipio: string;
  obitos: number;
  /** taxa por 100 mil; null quando o denominador populacional esta ausente */
  taxa: number | null;
}

export interface OpcoesR1 {
  /**
   * Sujeito da frase, com artigo (concordancia de genero fica por conta do
   * chamador): "A taxa" (padrao, exemplo literal do documento-fonte) ou,
   * por exemplo, "O total de óbitos" quando a serie e uma contagem, nao
   * uma taxa — usar o rotulo errado afirmaria uma coisa que o numero nao e.
   */
  sujeito?: string;
  /** Formatador do valor: formatTaxa100k (padrao) para taxa, formatNumber para contagem. */
  formatarValor?: (valor: number) => string;
}

export interface InputG1 {
  totalObitos: number;
}

export interface InputG2 {
  totalObitos: number;
  /** proporcao dos obitos do recorte concentrada no dia de maior numero (0-1) */
  shareDiaPico: number;
  /** data do dia de pico, quando disponivel (nem toda fonte de dado tem essa granularidade) */
  dataPico?: string;
}

export type Regra = "R1" | "R2" | "R3";
export type Guarda = "G1" | "G2";

export interface LeituraGerada {
  gerado: true;
  regra: Regra;
  texto: string;
}

export interface LeituraSuprimida {
  gerado: false;
  regra: Guarda;
  texto: string;
}

export type Leitura = LeituraGerada | LeituraSuprimida;

/**
 * Entrada do orquestrador gerarLeitura(): cada campo e opcional porque nem
 * toda tela tem dado suficiente para todo check — o orquestrador so tenta
 * o que recebeu. `r1.opcoes` existe porque nem toda serie de R1 e uma taxa
 * (ver OpcoesR1 em tendencia.ts) — o template so pode dizer "a taxa" quando
 * o valor realmente e uma taxa.
 */
export interface EntradaLeitura {
  g1?: InputG1;
  g2?: InputG2;
  r1?: { pontos: PontoSerieAnual[]; opcoes?: OpcoesR1 };
  r2?: MunicipioContagem[];
  r3?: MunicipioTaxa[];
}
