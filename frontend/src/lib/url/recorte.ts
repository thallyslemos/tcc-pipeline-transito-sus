import type { FilterValues } from "@/lib/types";

/**
 * design/DESIGN_SYSTEM.md §5.6 — "link do recorte" (BarraDeRecorte): a URL
 * reproduz exatamente o estado filtrado, pra citar a tela na monografia sem
 * depender de print. Serializacao pura, sem side-effect — quem chama decide
 * quando ler/escrever (useSearchParams/useRouter, so em componente client).
 */

const CHAVES_RECORTE = ["dimensao", "uf", "regiao", "ano", "tipo_veiculo", "municipio"] as const;

/** Nucleo persistido entre paginas (Sidebar + useRecorte). */
export const CHAVES_RECORTE_NUCLEO = ["dimensao", "uf", "ano", "municipio"] as const;

export const STORAGE_KEY_RECORTE = "recorte-v1";

/** Rotas institucionais — links da sidebar nao carregam query de filtro. */
export const ROTAS_SEM_RECORTE = ["/sobre", "/dados", "/chat"] as const;

/** Paginas territoriais agregadas — municipio do nucleo nao deve persistir. */
export const ROTAS_AGREGADAS = ["/dashboard", "/ranking", "/mapa", "/temporal", "/fluxos"] as const;

export const ROTA_PRELIMINARES = "/preliminares";
export const ROTA_MUNICIPIO = "/municipio";

export const PRELIM_ANO_MIN = 2025;

export interface FilterOption {
  value: string;
  label: string;
}

export function isRotaAgregada(pathname: string): boolean {
  return ROTAS_AGREGADAS.some((rota) => pathname.startsWith(rota));
}

export function isRotaPreliminares(pathname: string): boolean {
  return pathname.startsWith(ROTA_PRELIMINARES);
}

export function ordenarOpcoesFilter(options: FilterOption[]): FilterOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Se ano nao esta no catalogo, usa o ultimo disponivel ou undefined. */
export function sanitizarAno(
  ano: number | undefined,
  anosDisponiveis: number[],
  fallback: "undefined" | "last" = "last"
): number | undefined {
  if (ano == null) return undefined;
  if (anosDisponiveis.includes(ano)) return ano;
  if (fallback === "last" && anosDisponiveis.length > 0) return anosDisponiveis.at(-1);
  return undefined;
}

/** Politica de recorte por rota (municipio, ano preliminar vs consolidado). */
export function recorteParaRota(
  pathname: string,
  recorte: FilterValues,
  anosDisponiveis?: number[]
): FilterValues {
  let next: FilterValues = { ...recorte };

  if (isRotaAgregada(pathname)) {
    const { municipio: _ignorado, ...resto } = next;
    next = resto;
  }

  if (isRotaPreliminares(pathname)) {
    if (next.ano != null && next.ano < PRELIM_ANO_MIN) {
      next = { ...next, ano: PRELIM_ANO_MIN };
    }
  } else if (anosDisponiveis && anosDisponiveis.length > 0 && next.ano != null) {
    next = { ...next, ano: sanitizarAno(next.ano, anosDisponiveis) };
  }

  return next;
}

export function hrefComRecorteParaRota(path: string, filters: Partial<FilterValues>): string {
  if (ROTAS_SEM_RECORTE.some((rota) => path.startsWith(rota))) return path;
  const ajustado = recorteParaRota(path, { dimensao: "ocorrencia", ...filters });
  const qs = serializarRecorteNucleo(ajustado).toString();
  return qs ? `${path}?${qs}` : path;
}

export function recortesEquivalentes(a: FilterValues, b: FilterValues): boolean {
  return serializarRecorte(a).toString() === serializarRecorte(b).toString();
}

/** Valores do FilterBar sempre como string; omite valores orfaos (sem option). */
export function valoresFilterBar(
  recorte: FilterValues,
  chaves: string[],
  optionsPorChave: Partial<Record<string, FilterOption[]>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chave of chaves) {
    const bruto = recorte[chave as keyof FilterValues];
    const str = bruto != null && bruto !== "" ? String(bruto) : "";
    const options = optionsPorChave[chave];
    if (str && options && !options.some((o) => o.value === str)) {
      out[chave] = "";
    } else {
      out[chave] = str;
    }
  }
  return out;
}

export function serializarRecorte(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  for (const chave of CHAVES_RECORTE) {
    const valor = filters[chave];
    if (valor !== undefined && valor !== null && valor !== "") {
      params.set(chave, String(valor));
    }
  }
  return params;
}

export function lerRecorteDaUrl(searchParams: URLSearchParams): Partial<FilterValues> {
  const resultado: Partial<FilterValues> = {};

  const dimensao = searchParams.get("dimensao");
  if (dimensao === "ocorrencia" || dimensao === "residencia") resultado.dimensao = dimensao;

  const uf = searchParams.get("uf");
  if (uf) resultado.uf = uf;

  const regiao = searchParams.get("regiao");
  if (regiao) resultado.regiao = regiao;

  const ano = searchParams.get("ano");
  if (ano) {
    const numero = Number(ano);
    if (!Number.isNaN(numero)) resultado.ano = numero;
  }

  const tipoVeiculo = searchParams.get("tipo_veiculo");
  if (tipoVeiculo) resultado.tipo_veiculo = tipoVeiculo;

  const municipio = searchParams.get("municipio");
  if (municipio) resultado.municipio = municipio;

  return resultado;
}

export function serializarRecorteNucleo(filters: Partial<FilterValues>): URLSearchParams {
  const params = new URLSearchParams();
  for (const chave of CHAVES_RECORTE_NUCLEO) {
    const valor = filters[chave];
    if (valor !== undefined && valor !== null && valor !== "") {
      params.set(chave, String(valor));
    }
  }
  return params;
}

export function lerRecorteNucleo(searchParams: URLSearchParams): Partial<FilterValues> {
  const completo = lerRecorteDaUrl(searchParams);
  const nucleo: Partial<FilterValues> = {};
  if (completo.dimensao) nucleo.dimensao = completo.dimensao;
  if (completo.uf) nucleo.uf = completo.uf;
  if (completo.ano != null) nucleo.ano = completo.ano;
  if (completo.municipio) nucleo.municipio = completo.municipio;
  return nucleo;
}

export function hrefComRecorte(path: string, filters: Partial<FilterValues>): string {
  if (ROTAS_SEM_RECORTE.some((rota) => path.startsWith(rota))) return path;
  const qs = serializarRecorteNucleo(filters).toString();
  return qs ? `${path}?${qs}` : path;
}

export function salvarRecorteSession(filters: Partial<FilterValues>): void {
  if (typeof window === "undefined") return;
  try {
    const nucleo = lerRecorteNucleo(
      new URLSearchParams(serializarRecorteNucleo(filters).toString())
    );
    sessionStorage.setItem(STORAGE_KEY_RECORTE, JSON.stringify(nucleo));
  } catch {
    /* quota ou modo privado */
  }
}

export function lerRecorteSession(): Partial<FilterValues> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_RECORTE);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<FilterValues>;
  } catch {
    return {};
  }
}

/** Telas agregadas (ranking, dashboard, mapa) ignoram municipio do nucleo persistido. */
export function recorteAgregadoMunicipal(filters: FilterValues): FilterValues {
  const { municipio: _ignorado, ...resto } = filters;
  return resto;
}
