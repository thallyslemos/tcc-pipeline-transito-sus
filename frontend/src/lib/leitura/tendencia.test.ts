import { describe, expect, it } from "vitest";
import { gerarR1, podeAplicarR1 } from "./tendencia";

describe("R1 · tendencia", () => {
  it("nao aplica com menos de 3 pontos", () => {
    expect(podeAplicarR1([{ periodo: "2010", valor: 10 }])).toBe(false);
    expect(gerarR1([{ periodo: "2010", valor: 10 }])).toBeNull();
  });

  it("aplica com 3+ pontos e reporta alta", () => {
    const serie = [
      { periodo: "2010", valor: 18.2 },
      { periodo: "2017", valor: 15.0 },
      { periodo: "2024", valor: 20.3 },
    ];
    const leitura = gerarR1(serie);
    expect(leitura).not.toBeNull();
    expect(leitura?.gerado).toBe(true);
    expect(leitura?.regra).toBe("R1");
    expect(leitura?.texto).toContain("18,2");
    expect(leitura?.texto).toContain("2010");
    expect(leitura?.texto).toContain("20,3");
    expect(leitura?.texto).toContain("2024");
    expect(leitura?.texto).toContain("alta");
    expect(leitura?.texto).toContain("Mínimo da janela: 15,0 em 2017");
  });

  it("reporta queda quando o ultimo ponto e menor que o primeiro", () => {
    const serie = [
      { periodo: "2010", valor: 20 },
      { periodo: "2017", valor: 18 },
      { periodo: "2024", valor: 15 },
    ];
    const leitura = gerarR1(serie);
    expect(leitura?.texto).toContain("queda");
  });

  it("aceita sujeito e formatador customizados para series que nao sao taxa", () => {
    const serie = [
      { periodo: "2024-01", valor: 279 },
      { periodo: "2024-02", valor: 209 },
      { periodo: "2024-03", valor: 300 },
    ];
    const leitura = gerarR1(serie, {
      sujeito: "O total de óbitos",
      formatarValor: (v) => v.toLocaleString("pt-BR"),
    });
    expect(leitura?.texto).toContain("O total de óbitos passou de 279");
    expect(leitura?.texto).not.toContain("A taxa");
  });

  it("calcula percentual de variacao corretamente", () => {
    const serie = [
      { periodo: "2020", valor: 10 },
      { periodo: "2021", valor: 12 },
      { periodo: "2022", valor: 20 },
    ];
    const leitura = gerarR1(serie);
    // (20-10)/10 * 100 = 100%
    expect(leitura?.texto).toContain("100,0%");
  });
});
