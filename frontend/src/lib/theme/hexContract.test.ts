import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * design/DESIGN_SYSTEM.md — "nenhum hexadecimal deve existir fora de
 * app/tokens.css e src/lib/theme/" (ver comentario no topo de tokens.css
 * pra lista completa das excecoes, com o motivo de cada uma).
 */
const SRC_DIR = join(__dirname, "..", "..");

const ARQUIVOS_PERMITIDOS = new Set([
  "app/tokens.css",
  "lib/theme/chart.ts",
  "lib/theme/mapaClasses.ts",
  "lib/exportar/rasterizar.ts",
  "components/map/FluxoMapView.tsx",
]);

const HEX_RE = /#[0-9a-fA-F]{6}\b/;
const EXTENSOES = new Set([".ts", ".tsx", ".css"]);

function listarArquivos(dir: string): string[] {
  const entradas = readdirSync(dir);
  const resultado: string[] = [];
  for (const entrada of entradas) {
    const caminho = join(dir, entrada);
    const info = statSync(caminho);
    if (info.isDirectory()) {
      resultado.push(...listarArquivos(caminho));
    } else if (EXTENSOES.has(caminho.slice(caminho.lastIndexOf(".")))) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

describe("regra de ouro — hex fora de tokens.css/lib/theme", () => {
  it("nao introduz cor hexadecimal fora das excecoes documentadas", () => {
    const violacoes: string[] = [];
    for (const caminho of listarArquivos(SRC_DIR)) {
      const relativo = relative(SRC_DIR, caminho).replace(/\\/g, "/");
      if (relativo.endsWith(".test.ts") || relativo.endsWith(".test.tsx")) continue;
      if (ARQUIVOS_PERMITIDOS.has(relativo)) continue;
      const conteudo = readFileSync(caminho, "utf-8");
      conteudo.split("\n").forEach((linha, indice) => {
        if (HEX_RE.test(linha)) violacoes.push(`${relativo}:${indice + 1}`);
      });
    }
    expect(violacoes).toEqual([]);
  });
});
