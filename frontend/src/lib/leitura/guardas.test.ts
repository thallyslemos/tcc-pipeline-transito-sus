import { describe, expect, it } from "vitest";
import { disparaG1, disparaG2, gerarG1, gerarG2 } from "./guardas";

describe("G1 · n insuficiente", () => {
  it("dispara com total < 20", () => {
    expect(disparaG1({ totalObitos: 5 })).toBe(true);
    const leitura = gerarG1({ totalObitos: 5 });
    expect(leitura?.gerado).toBe(false);
    expect(leitura?.regra).toBe("G1");
    expect(leitura?.texto).toContain("Com 5 óbitos");
    expect(leitura?.texto).toContain("leitura foi suprimida");
  });

  it("nao dispara com total >= 20", () => {
    expect(disparaG1({ totalObitos: 20 })).toBe(false);
    expect(gerarG1({ totalObitos: 20 })).toBeNull();
  });
});

describe("G2 · evento unico (caso Gaviao)", () => {
  it("dispara quando o dia de pico concentra mais de 50% do total", () => {
    // Gaviao 2024: 20 obitos, todos no mesmo dia (acidente na BR-324).
    expect(disparaG2({ totalObitos: 20, shareDiaPico: 1.0 })).toBe(true);
    const leitura = gerarG2({ totalObitos: 20, shareDiaPico: 1.0, dataPico: "2024-01-15" });
    expect(leitura?.gerado).toBe(false);
    expect(leitura?.regra).toBe("G2");
    expect(leitura?.texto).toContain("100,0%");
    expect(leitura?.texto).toContain("(2024-01-15)");
    expect(leitura?.texto).toContain("não risco habitual");
  });

  it("omite o parentese de data quando nao informada", () => {
    const leitura = gerarG2({ totalObitos: 20, shareDiaPico: 0.6 });
    expect(leitura?.texto).not.toContain("(");
    expect(leitura?.texto).toContain("60,0%");
  });

  it("nao dispara com share <= 50%", () => {
    expect(disparaG2({ totalObitos: 100, shareDiaPico: 0.5 })).toBe(false);
    expect(gerarG2({ totalObitos: 100, shareDiaPico: 0.3 })).toBeNull();
  });
});
