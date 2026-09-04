import { describe, expect, it } from "vitest";

import { buildAnoOptions, buildUfOptions } from "@/lib/filtros/catalogo";

describe("catalogo filtros", () => {
  it("ordena UFs alfabeticamente", () => {
    expect(buildUfOptions(["SP", "BA", "RJ"]).map((o) => o.value)).toEqual(["BA", "RJ", "SP"]);
  });

  it("ordena anos crescentes", () => {
    expect(buildAnoOptions([2024, 2010, 2020]).map((o) => o.value)).toEqual(["2010", "2020", "2024"]);
  });
});
