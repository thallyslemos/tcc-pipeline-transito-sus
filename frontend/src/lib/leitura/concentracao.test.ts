import { describe, expect, it } from "vitest";
import { gerarR2, podeAplicarR2 } from "./concentracao";

describe("R2 · concentracao", () => {
  it("nao aplica com menos de 5 municipios", () => {
    const municipios = [
      { municipio: "A", obitos: 10 },
      { municipio: "B", obitos: 5 },
    ];
    expect(podeAplicarR2(municipios)).toBe(false);
    expect(gerarR2(municipios)).toBeNull();
  });

  it("aplica com 5+ municipios, soma o top-5 e identifica o lider", () => {
    const municipios = [
      { municipio: "Salvador", obitos: 100 },
      { municipio: "Feira de Santana", obitos: 40 },
      { municipio: "Vitoria da Conquista", obitos: 30 },
      { municipio: "Ilheus", obitos: 20 },
      { municipio: "Itabuna", obitos: 10 },
      { municipio: "Camacari", obitos: 0 },
    ];
    // total = 200, top5 (exclui Camacari) = 200 -> 100%
    const leitura = gerarR2(municipios);
    expect(leitura).not.toBeNull();
    expect(leitura?.regra).toBe("R2");
    expect(leitura?.texto).toContain("Os 5 municípios de maior contagem");
    expect(leitura?.texto).toContain("100,0%");
    expect(leitura?.texto).toContain("liderados por Salvador com 100");
  });

  it("percentual reflete apenas o top-5 quando ha mais de 5 municipios com peso", () => {
    const municipios = [
      { municipio: "A", obitos: 50 },
      { municipio: "B", obitos: 20 },
      { municipio: "C", obitos: 15 },
      { municipio: "D", obitos: 10 },
      { municipio: "E", obitos: 5 },
      { municipio: "F", obitos: 50 }, // maior que A, entra no top5 no lugar de E
    ];
    const leitura = gerarR2(municipios);
    // ordenado desc: F(50) e A(50) empatados, B(20), C(15), D(10) -> top5 = 145
    // total geral = 150 -> 145/150 = 96.7%
    expect(leitura?.texto).toContain("96,7%");
  });
});
