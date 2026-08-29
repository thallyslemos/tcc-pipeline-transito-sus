import type { FilterValues } from "@/lib/types";

/**
 * design/DESIGN_SYSTEM.md §5.6 — "link do recorte" (BarraDeRecorte): a URL
 * reproduz exatamente o estado filtrado, pra citar a tela na monografia sem
 * depender de print. Serializacao pura, sem side-effect — quem chama decide
 * quando ler/escrever (useSearchParams/useRouter, so em componente client).
 */

const CHAVES_RECORTE = ["dimensao", "uf", "regiao", "ano", "tipo_veiculo", "municipio"] as const;

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
