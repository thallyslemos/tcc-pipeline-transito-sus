import { describe, expect, it } from "vitest";
import { gerarLeitura } from "./index";

describe("gerarLeitura · orquestrador", () => {
  it("retorna null quando nenhum campo dispara nem e informado", () => {
    expect(gerarLeitura({})).toBeNull();
  });

  it("guardas tem precedencia sobre regras: G1 vence mesmo com r1/r2/r3 presentes", () => {
    const leitura = gerarLeitura({
      g1: { totalObitos: 5 },
      r1: [
        { periodo: "2010", valor: 10 },
        { periodo: "2020", valor: 15 },
        { periodo: "2024", valor: 20 },
      ],
    });
    expect(leitura?.gerado).toBe(false);
    expect(leitura?.regra).toBe("G1");
  });

  it("G2 vence sobre regras quando G1 nao dispara mas G2 dispara", () => {
    const leitura = gerarLeitura({
      g1: { totalObitos: 20 }, // nao dispara (>= 20)
      g2: { totalObitos: 20, shareDiaPico: 0.9 }, // dispara
      r1: [
        { periodo: "2010", valor: 10 },
        { periodo: "2020", valor: 15 },
        { periodo: "2024", valor: 20 },
      ],
    });
    expect(leitura?.gerado).toBe(false);
    expect(leitura?.regra).toBe("G2");
  });

  it("sem guarda disparando, aplica a primeira regra com dado suficiente (R1 antes de R2/R3)", () => {
    const leitura = gerarLeitura({
      r1: [
        { periodo: "2010", valor: 10 },
        { periodo: "2020", valor: 15 },
        { periodo: "2024", valor: 20 },
      ],
      r2: [
        { municipio: "A", obitos: 10 },
        { municipio: "B", obitos: 8 },
        { municipio: "C", obitos: 6 },
        { municipio: "D", obitos: 4 },
        { municipio: "E", obitos: 2 },
      ],
    });
    expect(leitura?.gerado).toBe(true);
    expect(leitura?.regra).toBe("R1");
  });

  it("cai para R2 quando R1 nao tem dado suficiente", () => {
    const leitura = gerarLeitura({
      r2: [
        { municipio: "A", obitos: 10 },
        { municipio: "B", obitos: 8 },
        { municipio: "C", obitos: 6 },
        { municipio: "D", obitos: 4 },
        { municipio: "E", obitos: 2 },
      ],
    });
    expect(leitura?.gerado).toBe(true);
    expect(leitura?.regra).toBe("R2");
  });
});
