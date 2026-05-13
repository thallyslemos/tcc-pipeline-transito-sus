export interface FilterValues {
  ano?: number;
  municipio?: string;
  tipo_veiculo?: string;
  uf?: string;
  regiao?: string;
  dimensao?: "ocorrencia" | "residencia";
}

export interface Municipio {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  lat: number | null;
  lon: number | null;
  obitos?: number;
}

export interface MapPoint {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  valor: number;
  lat: number | null;
  lon: number | null;
  atendimentos?: number;
  /** População (IBGE / Gold) quando disponível */
  populacao?: number | null;
  /** Mortes por 100 mil hab. (apenas métrica óbitos) */
  taxa_obitos_100mil?: number | null;
  /** Custo per capita em R$ (métrica custos, requer dim_ibge_populacao / join) */
  custo_per_capita?: number | null;
}

export interface DashboardData {
  total_obitos: number;
  total_custos: number;
  total_atendimentos: number;
  municipios: number;
  periodo: string;
  obitos_por_ano: { ano: number; total: number }[];
  custos_por_ano: { ano: number; total: number }[];
  obitos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  custos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  obitos_por_municipio: { municipio: string; total: number }[];
  custos_por_municipio: { municipio: string; total: number }[];
  serie_temporal_obitos: { competencia: string; valor: number }[];
  serie_temporal_custos: { competencia: string; valor: number }[];
  obitos_por_faixa_etaria: { faixa_etaria: string; total: number }[];
  obitos_por_sexo: { sexo: string; total: number }[];
}

export interface MunicipioDetail {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  lat: number | null;
  lon: number | null;
  total_obitos: number;
  total_custos: number;
  total_atendimentos: number;
  serie_obitos: { competencia: string; valor: number }[];
  serie_custos: { competencia: string; valor: number }[];
  obitos_por_tipo_veiculo: { tipo_veiculo: string; total: number }[];
  obitos_por_faixa_etaria: { faixa_etaria: string; total: number }[];
  obitos_por_sexo: { sexo: string; total: number }[];
}
