import type { FilterValues, MapPoint, Municipio, MunicipioDetail, DashboardData } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function qs(filters: FilterValues): string {
  const p = new URLSearchParams();
  if (filters.ano) p.set("ano", String(filters.ano));
  if (filters.municipio) p.set("municipio", filters.municipio);
  if (filters.tipo_veiculo) p.set("tipo_veiculo", filters.tipo_veiculo);
  if (filters.uf) p.set("uf", filters.uf);
  if (filters.regiao) p.set("regiao", filters.regiao);
  if (filters.dimensao) p.set("dimensao", filters.dimensao);
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const fetchSummary = (f: FilterValues = {}) =>
  get<DashboardData>(`/api/dashboard/summary${qs(f)}`);

export const fetchAnos = () =>
  get<{ anos: number[] }>("/api/dashboard/anos");

export const fetchTiposVeiculo = () =>
  get<{ tipos: string[] }>("/api/dashboard/tipos-veiculo");

export const fetchMunicipios = (f: FilterValues = {}) =>
  get<{ municipios: Municipio[] }>(`/api/dashboard/municipios${qs(f)}`);

export const fetchMunicipio = (cod: string, ano?: number, dimensao?: string) => {
  const params = new URLSearchParams();
  if (ano) params.set("ano", String(ano));
  if (dimensao) params.set("dimensao", dimensao);
  const qs = params.toString() ? `?${params}` : "";
  return get<MunicipioDetail>(`/api/dashboard/municipio/${cod}${qs}`);
};

export const fetchMapa = (
  metrica: string = "obitos",
  filtros?: FilterValues
) => {
  const p = new URLSearchParams({ metrica });
  if (filtros?.ano) p.set("ano", String(filtros.ano));
  if (filtros?.uf) p.set("uf", filtros.uf);
  if (filtros?.regiao) p.set("regiao", filtros.regiao);
  if (filtros?.dimensao) p.set("dimensao", filtros.dimensao);
  return get<{ metrica: string; ano: number | null; dados: MapPoint[] }>(
    `/api/dashboard/mapa?${p}`
  );
};

export interface IndicadorAnual {
  ano: number;
  populacao: number;
  obitos: number;
  taxa_obitos_100mil: number;
  custo_total: number;
  custo_per_capita: number;
  atendimentos: number;
  taxa_atend_100mil: number;
  frota_total?: number;
  taxa_obitos_por_10mil_veiculos?: number;
}

export interface IndicadoresMunicipio {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  regiao: string;
  dimensao_ativa?: string;
  area_km2: number;
  idh: number;
  pib_per_capita: number;
  indicadores: IndicadorAnual[];
  fontes: Record<string, string>;
}

export const fetchIndicadores = (cod: string, ano?: number, dimensao?: string) => {
  const p = new URLSearchParams();
  if (ano != null) p.set("ano", String(ano));
  if (dimensao) p.set("dimensao", dimensao);
  const q = p.toString() ? `?${p}` : "";
  return get<IndicadoresMunicipio>(`/api/indicadores/municipio/${cod}${q}`);
};

export interface SerieDiariaResumo {
  total_obitos_ano: number;
  max_obitos_dia: number;
  dia_pico: string | null;
  share_obitos_no_dia_pico: number;
  alerta_concentracao: boolean;
  limiar_share: number;
  limiar_obitos_ano: number;
}

export interface SerieDiariaResponse {
  cod_mun_ibge: string;
  ano: number;
  dimensao_ativa?: string;
  serie_diaria_disponivel: boolean;
  motivo?: string;
  pontos: { data: string; obitos: number }[];
  resumo: SerieDiariaResumo | null;
}

export const fetchSerieDiaria = (cod: string, ano: number, dimensao?: string) => {
  const p = new URLSearchParams({ ano: String(ano) });
  if (dimensao) p.set("dimensao", dimensao);
  return get<SerieDiariaResponse>(
    `/api/dashboard/municipio/${cod}/serie-diaria?${p}`
  );
};

export interface RankingItem {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  populacao: number;
  obitos: number;
  taxa_obitos_100mil: number;
  custo_total: number;
  custo_per_capita: number;
}

export const fetchRanking = (
  ano: number = 2023,
  metrica: string = "taxa_obitos_100mil",
  filtros?: FilterValues
) => {
  const p = new URLSearchParams({ ano: String(ano), metrica });
  if (filtros?.uf) p.set("uf", filtros.uf);
  if (filtros?.regiao) p.set("regiao", filtros.regiao);
  return get<{ ano: number; metrica: string; ranking: RankingItem[] }>(
    `/api/indicadores/ranking?${p}`
  );
};
