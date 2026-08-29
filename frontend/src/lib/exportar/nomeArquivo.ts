/**
 * design/DESIGN_SYSTEM.md §11 — nome do arquivo carrega o recorte:
 * v01v89_ba_2010-2024_ocorrencia_taxa100k@2x.png
 */

export interface RecorteExportacao {
  uf?: string;
  regiao?: string;
  anoInicio?: number;
  anoFim?: number;
  dimensao?: "ocorrencia" | "residencia";
  /** id curto da medida, ex.: "taxa100k" — opcional, omite o segmento se ausente. */
  medida?: string;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function periodo(recorte: RecorteExportacao): string {
  if (recorte.anoInicio == null) return "2010-2024";
  if (recorte.anoFim == null || recorte.anoFim === recorte.anoInicio) return String(recorte.anoInicio);
  return `${recorte.anoInicio}-${recorte.anoFim}`;
}

export function nomeArquivoExportacao(recorte: RecorteExportacao, extensao: "png" | "csv"): string {
  const partes = [
    "v01v89",
    slug(recorte.uf ?? recorte.regiao ?? "brasil"),
    periodo(recorte),
    recorte.dimensao ?? "ocorrencia",
  ];
  if (recorte.medida) partes.push(slug(recorte.medida));

  const base = partes.join("_");
  return extensao === "png" ? `${base}@2x.png` : `${base}.csv`;
}
