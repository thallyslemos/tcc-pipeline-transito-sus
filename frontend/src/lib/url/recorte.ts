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
