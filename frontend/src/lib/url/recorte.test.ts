import { describe, expect, it } from "vitest";
import { hrefComRecorte, lerRecorteDaUrl, recorteAgregadoMunicipal, serializarRecorte, serializarRecorteNucleo } from "./recorte";

describe("serializarRecorte", () => {
  it("inclui so os campos definidos e nao-vazios", () => {
    const params = serializarRecorte({ dimensao: "ocorrencia", uf: "BA", ano: 2024 });
    expect(params.get("dimensao")).toBe("ocorrencia");
    expect(params.get("uf")).toBe("BA");
    expect(params.get("ano")).toBe("2024");
    expect(params.has("regiao")).toBe(false);
    expect(params.has("tipo_veiculo")).toBe(false);
  });

  it("omite campos undefined, vazio ou nulo", () => {
    const params = serializarRecorte({ uf: "", ano: undefined });
    expect(params.toString()).toBe("");
  });
});

describe("lerRecorteDaUrl", () => {
  it("reconstroi o recorte a partir da URL", () => {
    const params = new URLSearchParams("dimensao=residencia&uf=SP&ano=2023&tipo_veiculo=Motociclista");
    const recorte = lerRecorteDaUrl(params);
    expect(recorte).toEqual({ dimensao: "residencia", uf: "SP", ano: 2023, tipo_veiculo: "Motociclista" });
  });

  it("ignora dimensao invalida", () => {
    const params = new URLSearchParams("dimensao=invalida");
    expect(lerRecorteDaUrl(params).dimensao).toBeUndefined();
  });

  it("ignora ano nao numerico", () => {
    const params = new URLSearchParams("ano=abc");
    expect(lerRecorteDaUrl(params).ano).toBeUndefined();
  });

  it("URL vazia produz recorte vazio", () => {
    expect(lerRecorteDaUrl(new URLSearchParams())).toEqual({});
  });

  it("round-trip: serializar depois ler reproduz o mesmo recorte", () => {
    const original: Parameters<typeof serializarRecorte>[0] = {
      dimensao: "ocorrencia",
      uf: "BA",
      ano: 2024,
      tipo_veiculo: "Automovel",
      municipio: "Salvador",
    };
    const params = serializarRecorte(original);
    expect(lerRecorteDaUrl(params)).toEqual(original);
  });
});

describe("hrefComRecorte", () => {
  it("preserva nucleo dimensao/uf/ano/municipio na navegacao", () => {
    const href = hrefComRecorte("/mapa", { dimensao: "ocorrencia", uf: "BA", ano: 2024, municipio: "2927408" });
    expect(href).toBe("/mapa?dimensao=ocorrencia&uf=BA&ano=2024&municipio=2927408");
  });

  it("nao anexa query em rotas institucionais", () => {
    expect(hrefComRecorte("/sobre", { uf: "BA", ano: 2024 })).toBe("/sobre");
  });

  it("serializarRecorteNucleo omite regiao e tipo_veiculo", () => {
    const params = serializarRecorteNucleo({ dimensao: "ocorrencia", uf: "BA", regiao: "Nordeste", tipo_veiculo: "Moto" });
    expect(params.get("uf")).toBe("BA");
    expect(params.has("regiao")).toBe(false);
    expect(params.has("tipo_veiculo")).toBe(false);
  });
});

describe("recorteAgregadoMunicipal", () => {
  it("remove municipio para consultas territoriais", () => {
    expect(recorteAgregadoMunicipal({ dimensao: "ocorrencia", uf: "CE", ano: 2023, municipio: "2304400" })).toEqual({
      dimensao: "ocorrencia",
      uf: "CE",
      ano: 2023,
    });
  });
});
