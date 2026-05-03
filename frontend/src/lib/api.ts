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

export const fetchMunicipio = (cod: string, ano?: number) =>
  get<MunicipioDetail>(`/api/dashboard/municipio/${cod}${ano ? `?ano=${ano}` : ""}`);

export const fetchMapa = (metrica: string = "obitos", ano?: number) => {
  const p = new URLSearchParams({ metrica });
  if (ano) p.set("ano", String(ano));
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
}

export interface IndicadoresMunicipio {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  regiao: string;
  area_km2: number;
  idh: number;
  pib_per_capita: number;
  indicadores: IndicadorAnual[];
  fontes: Record<string, string>;
}

export const fetchIndicadores = (cod: string, ano?: number) =>
  get<IndicadoresMunicipio>(
    `/api/indicadores/municipio/${cod}${ano ? `?ano=${ano}` : ""}`
  );

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

export const fetchRanking = (ano: number = 2023, metrica: string = "taxa_obitos_100mil") =>
  get<{ ano: number; metrica: string; ranking: RankingItem[] }>(
    `/api/indicadores/ranking?ano=${ano}&metrica=${metrica}`
  );
