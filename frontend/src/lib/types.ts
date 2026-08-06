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
  obitos_por_mes: { competencia: string; total: number }[];
  obitos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  obitos_por_faixa_etaria: { faixa_etaria: string; total: number }[];
  obitos_por_sexo: { sexo: string; total: number }[];
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
  frota_total?: number | null;
  frota_status?: "disponivel" | "indisponivel";
  taxa_obitos_10mil_veiculos?: number | null;
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
  frota_total: number | null;
  taxa_obitos_10mil_veiculos: number | null;
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

export interface SimFluxoEdge {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  obitos: number;
  participacao: number;
  propria_municipio: boolean;
  geografia_status: string;
}

export interface SimFluxo {
  fonte: "SIM";
  direcao: "origens" | "destinos";
  municipio_alvo: {
    cod_mun_ibge: string;
    municipio: string;
    uf: string;
  };
  total_obitos: number;
  total_ambos_encontrados: number;
  obitos_proprio_municipio: number;
  obitos_fora: number;
  proporcao_fora: number;
  municipios_conectados: number;
  arestas: SimFluxoEdge[];
  filtros: {
    ano: number | null;
    tipo_veiculo: string | null;
    top_n: number;
    min_obitos: number;
    incluir_desconhecidos: boolean;
  };
  notas_metodologicas: string;
}
