import { fetchSimMunicipios } from "@/lib/api";
import type { FilterValues } from "@/lib/types";
import type { FilterOption } from "@/lib/url/recorte";

import {
  buildAnoOptions,
  buildDimensaoOptions,
  buildRegiaoOptions,
  buildTipoVeiculoOptions,
  buildUfOptions,
} from "./catalogo";

export {
  buildAnoOptions,
  buildDimensaoOptions,
  buildRegiaoOptions,
  buildTipoVeiculoOptions,
  buildUfOptions,
} from "./catalogo";

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
  variant?: "select" | "combobox";
  onSearch?: (term: string) => Promise<FilterOption[]>;
}

export function buildFiltrosAgregados({
  anos,
  ufs,
  tipos,
  ufSelecionada,
  dimensao = "ocorrencia",
  municipioOpcoes = [],
  incluirMunicipio = false,
}: {
  anos: number[];
  ufs: string[];
  tipos: string[];
  ufSelecionada?: string;
  dimensao?: FilterValues["dimensao"];
  municipioOpcoes?: FilterOption[];
  incluirMunicipio?: boolean;
}): FilterDef[] {
  const ufList = [...new Set([...ufs, ...(ufSelecionada ? [ufSelecionada] : [])])];
  const filters: FilterDef[] = [
    { key: "dimensao", label: "Dimensao", options: buildDimensaoOptions() },
    {
      key: "regiao",
      label: "Regiao",
      options: buildRegiaoOptions(),
      placeholder: "Todas",
      variant: "combobox" as const,
    },
    {
      key: "uf",
      label: "UF",
      options: buildUfOptions(ufList),
      placeholder: "Todas",
      variant: "combobox" as const,
    },
    { key: "ano", label: "Ano", options: buildAnoOptions(anos) },
    {
      key: "tipo_veiculo",
      label: "Veiculo",
      options: buildTipoVeiculoOptions(tipos),
      placeholder: "Todos",
      variant: "combobox" as const,
    },
  ];

  if (incluirMunicipio) {
    filters.push({
      key: "municipio",
      label: "Município",
      options: municipioOpcoes,
      placeholder: "Todos",
      variant: "combobox" as const,
      onSearch: (term: string) => buscarMunicipioFilterOptions(term, dimensao, ufSelecionada),
    });
  }

  return filters;
}

export function buildFiltrosTemporal({
  anos,
  ufs,
  tipos,
  ufSelecionada,
}: {
  anos: number[];
  ufs: string[];
  tipos: string[];
  ufSelecionada?: string;
}) {
  return buildFiltrosAgregados({ anos, ufs, tipos, ufSelecionada }).filter((f) => f.key !== "dimensao");
}

export function buildFiltrosRanking({
  anos,
  ufs,
  ufSelecionada,
  dimensao = "ocorrencia",
  municipioOpcoes = [],
}: {
  anos: number[];
  ufs: string[];
  ufSelecionada?: string;
  dimensao?: FilterValues["dimensao"];
  municipioOpcoes?: FilterOption[];
}) {
  const ufList = [...new Set([...ufs, ...(ufSelecionada ? [ufSelecionada] : [])])];
  return [
    { key: "dimensao", label: "Dimensao", options: buildDimensaoOptions() },
    {
      key: "uf",
      label: "UF",
      options: buildUfOptions(ufList),
      placeholder: "Todas",
      variant: "combobox" as const,
    },
    {
      key: "municipio",
      label: "Município",
      options: municipioOpcoes,
      placeholder: "Todos",
      variant: "combobox" as const,
      onSearch: (term: string) => buscarMunicipioFilterOptions(term, dimensao, ufSelecionada),
    },
    { key: "ano", label: "Ano", options: buildAnoOptions(anos) },
  ];
}

export async function buscarMunicipioFilterOptions(
  term: string,
  dimensao: FilterValues["dimensao"] = "ocorrencia",
  uf?: string
): Promise<FilterOption[]> {
  const result = await fetchSimMunicipios({ dimensao, municipio: term, uf }, 1, 15);
  return result.municipios.map((m) => ({
    value: m.cod_mun_ibge,
    label: `${m.municipio} (${m.uf})`,
  }));
}

export function valoresRecorteFilter(
  recorte: FilterValues,
  chaves: string[],
  optionsPorChave: Partial<Record<string, FilterOption[]>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chave of chaves) {
    const bruto = recorte[chave as keyof FilterValues];
    const str = bruto != null && bruto !== "" ? String(bruto) : "";
    const options = optionsPorChave[chave];
    if (chave === "municipio") {
      out[chave] = str;
    } else if (str && options && !options.some((o) => o.value === str)) {
      out[chave] = "";
    } else {
      out[chave] = str;
    }
  }
  return out;
}
