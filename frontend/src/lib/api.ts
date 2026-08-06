import type {
  FilterValues,
  MapPoint,
  SimCatalog,
  SimFluxo,
  SimMunicipio,
  SimMunicipioDetail,
  SimSummary,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function simQuery(filters: FilterValues = {}): string {
  const params = new URLSearchParams();
  if (filters.ano) params.set("ano", String(filters.ano));
  if (filters.uf) params.set("uf", filters.uf);
  if (filters.regiao) params.set("regiao", filters.regiao);
  if (filters.tipo_veiculo) params.set("tipo_veiculo", filters.tipo_veiculo);
  if (filters.dimensao) params.set("dimensao", filters.dimensao);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const fetchSimSummary = (filters: FilterValues = {}) =>
  get<SimSummary>(`/api/sim/summary${simQuery(filters)}`);

export const fetchSimAnos = (dimensao: FilterValues["dimensao"] = "ocorrencia") =>
  get<{ dimensao: string; anos: number[] }>(`/api/sim/anos?dimensao=${dimensao}`);

export const fetchSimTipos = (dimensao: FilterValues["dimensao"] = "ocorrencia") =>
  get<{ dimensao: string; tipos: string[] }>(`/api/sim/tipos-veiculo?dimensao=${dimensao}`);

export const fetchSimMunicipios = (filters: FilterValues = {}, page = 1, pageSize = 200) => {
  const params = new URLSearchParams({
    dimensao: filters.dimensao ?? "ocorrencia",
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.ano) params.set("ano", String(filters.ano));
  if (filters.uf) params.set("uf", filters.uf);
  if (filters.regiao) params.set("regiao", filters.regiao);
  if (filters.tipo_veiculo) params.set("tipo_veiculo", filters.tipo_veiculo);
  if (filters.municipio) params.set("search", filters.municipio);
  return get<{ dimensao: string; page: number; page_size: number; total: number; municipios: SimMunicipio[] }>(
    `/api/sim/municipios?${params}`
  );
};

export const fetchSimMunicipio = (
  cod: string,
  ano?: number,
  dimensao: FilterValues["dimensao"] = "ocorrencia"
) => {
  const params = new URLSearchParams({ dimensao });
  if (ano) params.set("ano", String(ano));
  return get<SimMunicipioDetail>(`/api/sim/municipio/${cod}?${params}`);
};

export const fetchSimMetadata = () => get<SimCatalog>("/api/sim/metadata");

export interface SimGeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[];
}

export const fetchSimGeo = (filters: FilterValues = {}) =>
  get<SimGeoFeatureCollection>(`/api/sim/geo${simQuery(filters)}`);

export const fetchMapa = async (filters: FilterValues = {}) => {
  const collection = await fetchSimGeo(filters);
  const dados: MapPoint[] = collection.features.map((feature) => {
    const properties = feature.properties ?? {};
    return {
      cod_mun_ibge: String(properties.cod_mun_ibge ?? ""),
      municipio: String(properties.municipio ?? ""),
      uf: String(properties.uf ?? ""),
      valor: Number(properties.valor ?? 0),
      lat: null,
      lon: null,
      populacao: properties.populacao == null ? null : Number(properties.populacao),
      taxa_obitos_100mil: properties.taxa_obitos_100mil == null ? null : Number(properties.taxa_obitos_100mil),
      frota_total: properties.frota_total == null ? null : Number(properties.frota_total),
      frota_status: properties.frota_status === "disponivel" ? "disponivel" : "indisponivel",
      taxa_obitos_10mil_veiculos:
        properties.taxa_obitos_10mil_veiculos == null
          ? null
          : Number(properties.taxa_obitos_10mil_veiculos),
      has_data: properties.has_data !== false,
    };
  });
  return { metrica: "obitos", ano: filters.ano ?? null, dados, geojson: collection };
};

export const fetchForecast = (cod: string, ano: number, dimensao: FilterValues["dimensao"] = "ocorrencia") =>
  fetchSimMunicipio(cod, ano, dimensao);

export interface FluxoGeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[];
}

export const fetchSimFluxos = (
  codMunicipio: string,
  direcao: "origens" | "destinos" = "origens",
  filters: { ano?: number; tipo_veiculo?: string; top_n?: number; min_obitos?: number } = {}
) => {
  const params = new URLSearchParams({ cod_municipio: codMunicipio, direcao });
  if (filters.ano) params.set("ano", String(filters.ano));
  if (filters.tipo_veiculo) params.set("tipo_veiculo", filters.tipo_veiculo);
  if (filters.top_n) params.set("top_n", String(filters.top_n));
  if (filters.min_obitos) params.set("min_obitos", String(filters.min_obitos));
  return get<SimFluxo>(`/api/sim/fluxos?${params}`);
};

export const fetchSimFluxosGeo = (
  codMunicipio: string,
  direcao: "origens" | "destinos" = "origens",
  filters: { ano?: number; tipo_veiculo?: string; top_n?: number; min_obitos?: number } = {}
) => {
  const params = new URLSearchParams({ cod_municipio: codMunicipio, direcao });
  if (filters.ano) params.set("ano", String(filters.ano));
  if (filters.tipo_veiculo) params.set("tipo_veiculo", filters.tipo_veiculo);
  if (filters.top_n) params.set("top_n", String(filters.top_n));
  if (filters.min_obitos) params.set("min_obitos", String(filters.min_obitos));
  return get<FluxoGeoFeatureCollection>(`/api/sim/fluxos/geo?${params}`);
};
