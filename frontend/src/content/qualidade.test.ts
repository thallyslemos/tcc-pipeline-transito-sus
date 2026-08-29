import { describe, expect, it } from "vitest";
import { textoQualidade } from "./qualidade";

describe("textoQualidade", () => {
  it("populacao_estimada com defasagem", () => {
    const texto = textoQualidade({ motivo: "populacao_estimada", anoReferencia: 2022, defasagemAnos: 2 });
    expect(texto).toContain("ano 2022");
    expect(texto).toContain("defasagem de 2 anos");
  });

  it("populacao_estimada com defasagem de 1 ano usa singular", () => {
    const texto = textoQualidade({ motivo: "populacao_estimada", anoReferencia: 2023, defasagemAnos: 1 });
    expect(texto).toContain("defasagem de 1 ano)");
    expect(texto).not.toContain("1 anos");
  });

  it("populacao_estimada sem defasagem informada omite o parentese", () => {
    const texto = textoQualidade({ motivo: "populacao_estimada", anoReferencia: 2024 });
    expect(texto).not.toContain("defasagem");
  });

  it("preliminar com data de extracao", () => {
    const texto = textoQualidade({ motivo: "preliminar", dataExtracao: "2026-08-20" });
    expect(texto).toContain("extraído em 2026-08-20");
    expect(texto).toContain("sujeito a revisão");
  });

  it("preliminar sem data de extracao", () => {
    const texto = textoQualidade({ motivo: "preliminar" });
    expect(texto).not.toContain("extraído");
    expect(texto).toContain("sujeito a revisão");
  });

  it("frota_ausente", () => {
    expect(textoQualidade({ motivo: "frota_ausente" })).toContain("Frota SENATRAN não pareada");
  });
});
