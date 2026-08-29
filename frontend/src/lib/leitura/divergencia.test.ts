import { describe, expect, it } from "vitest";
import { gerarR3, podeAplicarR3 } from "./divergencia";

describe("R3 · divergencia", () => {
  it("nao aplica com menos de 2 municipios com taxa conhecida", () => {
    const municipios = [
      { municipio: "A", obitos: 10, taxa: 5.0 },
      { municipio: "B", obitos: 8, taxa: null },
    ];
    expect(podeAplicarR3(municipios)).toBe(false);
    expect(gerarR3(municipios)).toBeNull();
  });

  it("nao aplica quando o lider por contagem nao tem taxa conhecida", () => {
    const municipios = [
      { municipio: "Grande", obitos: 100, taxa: null },
      { municipio: "Pequeno1", obitos: 5, taxa: 50.0 },
      { municipio: "Pequeno2", obitos: 4, taxa: 40.0 },
    ];
    expect(gerarR3(municipios)).toBeNull();
  });

  it("identifica a divergencia entre lider por contagem e lider por taxa", () => {
    const municipios = [
      { municipio: "Salvador", obitos: 100, taxa: 5.0 },
      { municipio: "Gaviao", obitos: 20, taxa: 445.1 },
      { municipio: "Feira de Santana", obitos: 40, taxa: 15.0 },
    ];
    const leitura = gerarR3(municipios);
    expect(leitura).not.toBeNull();
    expect(leitura?.regra).toBe("R3");
    expect(leitura?.texto).toContain("Salvador lidera");
    // por taxa: Gaviao(445.1) > Feira(15.0) > Salvador(5.0) -> Salvador cai pra 3a posicao
    expect(leitura?.texto).toContain("3ª posição");
    expect(leitura?.texto).toContain("Gaviao");
    // razao = 445.1 / 5.0 = 89.02 -> arredondado 1 casa = 89
    expect(leitura?.texto).toContain("89×");
  });
});
