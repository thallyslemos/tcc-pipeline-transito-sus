export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/** Taxa por 100 mil habitantes (SIM / Ficha C.12) */
export function formatTaxa100k(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Taxa de obitos por 10 mil veiculos, quando a frota SENATRAN esta
 * disponivel. Auditoria A2: usava 2 casas decimais, inconsistente com a
 * taxa por 100 mil (1 casa) na mesma tabela — design/DESIGN_SYSTEM.md §2 e
 * a regra pt-BR nao abrem excecao por tipo de taxa.
 */
export function formatTaxa10k(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Percentual com uma casa decimal (design/DESIGN_SYSTEM.md §2: "percentual com uma casa"). */
export function formatPercentual(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Valor-p de teste estatistico (ex.: qui-quadrado). Auditoria A3: um valor-p
 * nunca e exatamente zero — "p=0.0000" (alem de nao ser pt-BR) e um valor
 * numericamente impossivel de se ler como fato; abaixo do menor valor
 * representavel com 4 casas, o certo e "p < 0,0001".
 */
export function formatPValor(value: number): string {
  if (value < 0.0001) return "p < 0,0001";
  return `p = ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value)}`;
}
