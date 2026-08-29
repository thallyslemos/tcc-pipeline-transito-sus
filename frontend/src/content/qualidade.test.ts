import { describe, expect, it } from "vitest";
import { coeficienteVariacao, taxaInstavel, textoQualidade } from "./qualidade";

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

  it("taxa_instavel cita o numero de obitos e o coeficiente de variacao", () => {
    // caso real: Gaviao, BA, 2024 — 20 obitos, taxa 445,1/100mil (auditoria A4)
    const texto = textoQualidade({ motivo: "taxa_instavel", obitos: 20 });
    expect(texto).toContain("20 óbitos");
    expect(texto).toContain("22%");
  });

  it("taxa_instavel usa singular para 1 obito", () => {
    expect(textoQualidade({ motivo: "taxa_instavel", obitos: 1 })).toContain("1 óbito ");
  });
});

describe("coeficienteVariacao", () => {
  it("CV = 1/sqrt(obitos)", () => {
    expect(coeficienteVariacao(20)).toBeCloseTo(0.2236, 4);
    expect(coeficienteVariacao(100)).toBeCloseTo(0.1, 4);
  });

  it("obitos zero da CV infinito (instabilidade maxima)", () => {
    expect(coeficienteVariacao(0)).toBe(Infinity);
  });
});

describe("taxaInstavel", () => {
  it("Gaviao (BA, 2024): 20 obitos, populacao 4.493 — instavel pela populacao", () => {
    expect(taxaInstavel(20, 4493)).toBe(true);
  });

  it("obitos abaixo do limiar e instavel mesmo com populacao grande", () => {
    expect(taxaInstavel(19, 1_000_000)).toBe(true);
  });

  it("populacao abaixo do limiar e instavel mesmo com muitos obitos", () => {
    expect(taxaInstavel(500, 20_000)).toBe(true);
  });

  it("municipio grande com muitos obitos nao e instavel", () => {
    expect(taxaInstavel(210, 2_900_000)).toBe(false);
  });

  it("populacao nula nao dispara pela populacao, so pelo N de obitos", () => {
    expect(taxaInstavel(50, null)).toBe(false);
    expect(taxaInstavel(5, null)).toBe(true);
  });
});
