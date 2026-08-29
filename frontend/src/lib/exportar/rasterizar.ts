import { toPng } from "html-to-image";

export interface OpcoesExportarPng {
  pixelRatio?: number;
}

/**
 * design/DESIGN_SYSTEM.md §11 — PNG @2x do grafico/mapa com a moldura
 * rasterizada junto (titulo, legenda, ressalva e proveniencia fazem parte
 * da imagem — uma figura exportada sem moldura nao e citavel). SEMPRE
 * renderizado em tema claro, mesmo com a tela em escuro (a monografia e
 * impressa) — alterna a classe .dark do <html> (nao data-theme: o
 * ThemeProvider usa classList.toggle("dark", ...), nao um atributo) so
 * durante a captura, e restaura o tema real logo depois.
 *
 * So roda no browser (usa document) — chamar so a partir de um handler de
 * clique em componente client.
 */
export async function exportarPng(
  elemento: HTMLElement,
  nomeArquivo: string,
  opcoes: OpcoesExportarPng = {}
): Promise<void> {
  const root = document.documentElement;
  const estavaEscuro = root.classList.contains("dark");
  if (estavaEscuro) root.classList.remove("dark");

  try {
    if (estavaEscuro) {
      // Aguarda um frame pra garantir que os estilos de tema claro ja
      // foram recalculados antes de capturar.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    const dataUrl = await toPng(elemento, {
      pixelRatio: opcoes.pixelRatio ?? 2,
      backgroundColor: "#FAFAF9",
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = nomeArquivo;
    link.click();
  } finally {
    if (estavaEscuro) root.classList.add("dark");
  }
}
