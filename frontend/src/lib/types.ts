export interface FilterValues {
  ano?: number;
  municipio?: string;
  tipo_veiculo?: string;
  uf?: string;
  regiao?: string;
  dimensao?: "ocorrencia" | "residencia";
}

export interface SimSummary {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  total_obitos: number;
  municipios: number;
  periodo: string;
  obitos_por_ano: { ano: number; total: number }[];
  denominadores: { populacao: string; frota: string };
}

export interface SimMunicipio {
  cod_mun_ibge: string;
  cod_mun_ibge_6?: string;
  municipio: string;
  uf: string;
  obitos: number;
  populacao: number | null;
  taxa_obitos_100mil: number | null;
  populacao_status: "disponivel" | "indisponivel";
}

export interface SimMunicipioDetail {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  total_obitos: number;
  populacao: number | null;
  taxa_obitos_100mil: number | null;
  populacao_status: "disponivel" | "indisponivel";
  frota_status: "disponivel" | "indisponivel";
  serie_mensal: { competencia: string; obitos: number }[];
}

export interface SimCatalogDataset {
  id: string;
  layer: string;
  status: string;
  provider: string;
  source_url?: string;
  source_dataset?: string;
  coverage?: Record<string, unknown>;
  grain?: string;
  keyso: string[];
  quality?: Record<string, unknown>;
  path?: string;
  byteso: number;
  sha256?: string;
  noteso: string;
}

export interface SimCatalog {
  catalog_version: string;
  generated_at: string;
  scope: string;
  datasets: SimCatalogDataset[];
}

export interface MapPoint {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  valor: number;
  lat: number | null;
  lon: number | null;
  populacao?: number | null;
  taxa_obitos_100mil?: number | null;
  frota_total?: number | null;
  frota_status?: "disponivel" | "indisponivel";
  taxa_obitos_10mil_veiculos?: number | null;
  has_data?: boolean;
}

export interface RankingItem extends SimMunicipio {}

export interface ForecastPoint {
  competencia: string;
  valor: number;
}
