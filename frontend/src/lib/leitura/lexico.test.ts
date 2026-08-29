import { describe, expect, it } from "vitest";
import { gerarR1 } from "./tendencia";
import { gerarR2 } from "./concentracao";
import { gerarR3 } from "./divergencia";
import { gerarG1, gerarG2 } from "./guardas";

/**
 * design/DESIGN_SYSTEM.md §6.2 — "Léxico: o que a camada 3 nunca escreve":
 * verbo causal, superlativo sem denominador, projeção futura, adjetivo de
 * alarme. Este teste varre os textos gerados pelos templates fixos das 3
 * regras + 2 guardas contra a lista proibida; não impede texto dinâmico
 * ruim (isso é revisão humana), mas trava regressão nos gabaritos.
 */
const LEXICO_PROIBIDO = [
  "provoca",
  "explica",
  "por causa de",
  "responsável por",
  "alarmante",
  "explosão",
  "tragédia",
  "epidemia",
];

const AMOSTRAS: { nome: string; texto: string }[] = [
  {
    nome: "R1",
    texto: gerarR1([
      { periodo: "2010", valor: 18.2 },
      { periodo: "2017", valor: 15.0 },
      { periodo: "2024", valor: 20.3 },
    ])!.texto,
  },
  {
    nome: "R2",
    texto: gerarR2([
      { municipio: "Salvador", obitos: 100 },
      { municipio: "Feira de Santana", obitos: 40 },
      { municipio: "Vitoria da Conquista", obitos: 30 },
      { municipio: "Ilheus", obitos: 20 },
      { municipio: "Itabuna", obitos: 10 },
    ])!.texto,
  },
  {
    nome: "R3",
    texto: gerarR3([
      { municipio: "Salvador", obitos: 100, taxa: 5.0 },
      { municipio: "Gaviao", obitos: 20, taxa: 445.1 },
    ])!.texto,
  },
  { nome: "G1", texto: gerarG1({ totalObitos: 5 })!.texto },
  { nome: "G2", texto: gerarG2({ totalObitos: 20, shareDiaPico: 1.0, dataPico: "2024-01-15" })!.texto },
];

describe("léxico proibido na Camada 3", () => {
  for (const { nome, texto } of AMOSTRAS) {
    it.each(LEXICO_PROIBIDO)(`${nome}: nao contem "%s"`, (termo) => {
      expect(texto.toLowerCase()).not.toContain(termo.toLowerCase());
    });
  }
});
