import { describe, expect, it } from "vitest";
import { nomeArquivoExportacao } from "./nomeArquivo";

describe("nomeArquivoExportacao", () => {
  it("gera o nome exemplo do design system (§11)", () => {
    const nome = nomeArquivoExportacao(
      { uf: "BA", anoInicio: 2010, anoFim: 2024, dimensao: "ocorrencia", medida: "taxa100k" },
      "png"
    );
    expect(nome).toBe("v01v89_ba_2010-2024_ocorrencia_taxa100k@2x.png");
  });

  it("ano unico (sem fim ou fim igual ao inicio) nao vira intervalo", () => {
    expect(nomeArquivoExportacao({ uf: "BA", anoInicio: 2024 }, "png")).toContain("_2024_");
    expect(nomeArquivoExportacao({ uf: "BA", anoInicio: 2024, anoFim: 2024 }, "png")).toContain("_2024_");
  });

  it("sem ano informado usa o periodo padrao 2010-2024", () => {
    expect(nomeArquivoExportacao({ uf: "BA" }, "png")).toContain("_2010-2024_");
  });

  it("sem uf/regiao usa 'brasil'", () => {
    expect(nomeArquivoExportacao({}, "csv")).toContain("_brasil_");
  });

  it("remove acentos e espacos do slug de UF/regiao", () => {
    expect(nomeArquivoExportacao({ regiao: "Centro-Oeste" }, "png")).toContain("centrooeste");
  });

  it("extensao csv nao tem sufixo @2x", () => {
    const nome = nomeArquivoExportacao({ uf: "BA", anoInicio: 2024 }, "csv");
    expect(nome.endsWith(".csv")).toBe(true);
    expect(nome).not.toContain("@2x");
  });

  it("omite o segmento de medida quando nao informado", () => {
    const nome = nomeArquivoExportacao({ uf: "BA", anoInicio: 2024 }, "png");
    expect(nome).toBe("v01v89_ba_2024_ocorrencia@2x.png");
  });
});
