import { describe, expect, it } from "vitest";
import { BREAKS, classeDe, corClasseFixa, rampaClasses } from "./mapaClasses";

describe("classeDe", () => {
  it("classe 0 para valores abaixo do primeiro corte", () => {
    expect(classeDe(0)).toBe(0);
    expect(classeDe(11.9)).toBe(0);
  });

  it("classes fixas nos limites exatos (§8: cortes 12/18/26/39)", () => {
    expect(BREAKS).toEqual([12, 18, 26, 39]);
    expect(classeDe(12)).toBe(1);
    expect(classeDe(17.9)).toBe(1);
    expect(classeDe(18)).toBe(2);
    expect(classeDe(25.9)).toBe(2);
    expect(classeDe(26)).toBe(3);
    expect(classeDe(38.9)).toBe(3);
    expect(classeDe(39)).toBe(4);
    expect(classeDe(1000)).toBe(4);
  });

  it("o mesmo valor sempre cai na mesma classe, independente de outros valores do recorte (classe fixa, nao relativa)", () => {
    // Ao contrario da escala antiga (min/max do recorte), classeDe nao
    // recebe nem depende de nenhum outro dado do conjunto filtrado.
    expect(classeDe(20.9)).toBe(classeDe(20.9));
    expect(classeDe(20.9)).toBe(2);
  });
});

describe("corClasseFixa / rampaClasses", () => {
  it("retorna cores diferentes para tema claro e escuro", () => {
    expect(corClasseFixa(5, false)).not.toBe(corClasseFixa(5, true));
  });

  it("rampa tem 5 cores, uma por classe", () => {
    expect(rampaClasses(false)).toHaveLength(5);
    expect(rampaClasses(true)).toHaveLength(5);
  });

  it("corClasseFixa indexa a mesma rampa que rampaClasses", () => {
    expect(corClasseFixa(20.9, false)).toBe(rampaClasses(false)[2]);
  });
});
