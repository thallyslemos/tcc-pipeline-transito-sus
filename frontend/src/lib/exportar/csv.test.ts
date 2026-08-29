import { describe, expect, it } from "vitest";
import { gerarCsv } from "./csv";

describe("gerarCsv", () => {
  it("string vazia para lista vazia", () => {
    expect(gerarCsv([])).toBe("");
  });

  it("gera cabecalho a partir das chaves da primeira linha", () => {
    const csv = gerarCsv([{ municipio: "Salvador", obitos: 210, populacao: 2900000 }]);
    const [cabecalho, corpo] = csv.split("\n");
    expect(cabecalho).toBe("municipio;obitos;populacao");
    expect(corpo).toBe("Salvador;210;2900000");
  });

  it("mantem numerador e denominador em colunas separadas (design/DESIGN_SYSTEM.md §11)", () => {
    const csv = gerarCsv([{ municipio: "Salvador", obitos_numerador: 210, populacao_denominador: 2900000 }]);
    expect(csv).toContain("obitos_numerador;populacao_denominador");
  });

  it("null vira celula vazia, nunca a string 'null'", () => {
    const csv = gerarCsv([{ municipio: "X", taxa: null }]);
    expect(csv).toBe("municipio;taxa\nX;");
  });

  it("escapa valores com ponto-e-virgula, aspas ou quebra de linha", () => {
    const csv = gerarCsv([{ nota: 'contém ; e "aspas"' }]);
    expect(csv).toBe('nota\n"contém ; e ""aspas"""');
  });

  it("usa ponto-e-virgula como delimitador (pt-BR usa virgula como decimal)", () => {
    const csv = gerarCsv([{ a: 1, b: 2 }]);
    expect(csv.split("\n")[0]).toBe("a;b");
  });
});
