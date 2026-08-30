/**
 * design/DESIGN_SYSTEM.md §11 — CSV com numerador e denominador em colunas
 * separadas, pra taxa poder ser recalculada fora do sistema. Separador ";"
 * (nao ","): pt-BR usa virgula como separador decimal, entao virgula como
 * delimitador de coluna quebraria no Excel em pt-BR.
 */

export type LinhaCsv = Record<string, string | number | null>;

function formatarCelula(valor: string | number | null): string {
  if (valor == null) return "";
  const texto = String(valor);
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function gerarCsv(linhas: LinhaCsv[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const cabecalho = colunas.join(";");
  const corpo = linhas.map((linha) => colunas.map((coluna) => formatarCelula(linha[coluna])).join(";")).join("\n");
  return `${cabecalho}\n${corpo}`;
}

/** So roda no browser (usa document/URL) — chamar so a partir de um handler de clique em componente client. */
export function baixarCsv(nomeArquivo: string, linhas: LinhaCsv[]): void {
  const conteudo = gerarCsv(linhas);
  // BOM UTF-8: sem isso o Excel em pt-BR abre acento como lixo.
  const blob = new Blob([`﻿${conteudo}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
