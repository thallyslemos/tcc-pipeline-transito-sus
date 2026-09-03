import { ordenarOpcoesFilter, type FilterOption } from "@/lib/url/recorte";

const REGIOES = ["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];

export function buildAnoOptions(anos: number[]): FilterOption[] {
  return [...anos].sort((a, b) => a - b).map((ano) => ({ value: String(ano), label: String(ano) }));
}

export function buildUfOptions(ufs: string[]): FilterOption[] {
  return ordenarOpcoesFilter(ufs.map((uf) => ({ value: uf, label: uf })));
}

export function buildTipoVeiculoOptions(tipos: string[]): FilterOption[] {
  return ordenarOpcoesFilter(tipos.map((tipo) => ({ value: tipo, label: tipo })));
}

export function buildRegiaoOptions(): FilterOption[] {
  return ordenarOpcoesFilter(REGIOES.map((regiao) => ({ value: regiao, label: regiao })));
}

export function buildDimensaoOptions(): FilterOption[] {
  return [
    { value: "ocorrencia", label: "Ocorrencia" },
    { value: "residencia", label: "Residencia" },
  ];
}
