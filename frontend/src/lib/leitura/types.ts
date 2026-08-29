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

/** Entrada do orquestrador gerarLeitura(): cada campo e opcional porque nem
 * toda tela tem dado suficiente para todo check — o orquestrador so tenta
 * o que recebeu. */
export interface EntradaLeitura {
  g1?: InputG1;
  g2?: InputG2;
  r1?: PontoSerieAnual[];
  r2?: MunicipioContagem[];
  r3?: MunicipioTaxa[];
}
