import { describe, expect, it } from "vitest";
import { ajuda } from "./ajuda";

const MAX_PALAVRAS = 45;
const BLOCOS = ["oQueMostra", "comoLer", "oQueNaoPermiteConcluir"] as const;

function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

describe("ajuda", () => {
  it("tem pelo menos um termo cadastrado", () => {
    expect(Object.keys(ajuda).length).toBeGreaterThan(0);
  });

  for (const [termo, entry] of Object.entries(ajuda)) {
    describe(termo, () => {
      it("tem titulo nao vazio", () => {
        expect(entry.titulo.trim().length).toBeGreaterThan(0);
      });

      for (const bloco of BLOCOS) {
        it(`bloco "${bloco}" tem no maximo ${MAX_PALAVRAS} palavras`, () => {
          const texto = entry[bloco];
          expect(texto.trim().length).toBeGreaterThan(0);
          expect(contarPalavras(texto)).toBeLessThanOrEqual(MAX_PALAVRAS);
        });
      }
    });
  }
});
