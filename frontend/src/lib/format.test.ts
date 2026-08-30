import { describe, expect, it } from "vitest";
import { formatPValor } from "./format";

describe("formatPValor", () => {
  it("usa 'p < 0,0001' abaixo do menor valor representavel com 4 casas", () => {
    expect(formatPValor(0)).toBe("p < 0,0001");
    expect(formatPValor(0.00004)).toBe("p < 0,0001");
    expect(formatPValor(0.00009999)).toBe("p < 0,0001");
  });

  it("formata com virgula pt-BR e 4 casas quando representavel", () => {
    expect(formatPValor(0.0001)).toBe("p = 0,0001");
    expect(formatPValor(0.05)).toBe("p = 0,0500");
    expect(formatPValor(0.123456)).toBe("p = 0,1235");
  });
});
