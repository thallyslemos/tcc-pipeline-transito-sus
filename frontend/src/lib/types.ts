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

export type PopulacaoOrigem = "exata" | "estimada" | null;

export interface SimMunicipio {
  cod_mun_ibge: string;
  cod_mun_ibge_6?: string;
  municipio: string;
  uf: string;
  obitos: number;
  populacao: number | null;
  taxa_obitos_100mil: number | null;
  populacao_status: "disponivel" | "indisponivel";
  populacao_origem?: PopulacaoOrigem;
  populacao_ano_referencia?: number | null;
  populacao_defasagem_anos?: number | null;
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
  populacao_origem?: PopulacaoOrigem;
  populacao_ano_referencia?: number | null;
  populacao_defasagem_anos?: number | null;
  frota_total: number | null;
  taxa_obitos_10mil_veiculos: number | null;
  frota_status: "disponivel" | "indisponivel";
  serie_mensal: { competencia: string; obitos: number }[];
}

export interface SimPopulacaoCobertura {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  total_municipio_ano: number;
  exata: number;
  estimada: number;
  indisponivel: number;
  notas_metodologicas: string;
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
  populacao_origem?: PopulacaoOrigem;
  populacao_ano_referencia?: number | null;
  populacao_defasagem_anos?: number | null;
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

export interface SerieMensalPonto {
  competencia: string;
  obitos: number;
}

export interface SerieMensalResumo {
  total_obitos: number;
  media_mensal: number | null;
  desvio_mensal: number | null;
  mes_pico: string | null;
  share_mes_pico: number | null;
  meses_com_obito: number;
  hhi_mensal: number | null;
  classe_concentracao: "concentrado" | "difuso" | null;
  alerta: boolean;
}

export interface SimSerieMensal {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  pontos: SerieMensalPonto[];
  resumo: SerieMensalResumo;
  filtros: Record<string, unknown>;
  notas_metodologicas: string;
}

export interface DiaSemanaDistribuicao {
  dia_semana: number;
  dia_semana_nome: string;
  obitos: number;
  dias_no_calendario: number;
  media_por_dia: number;
  proporcao_observada: number;
  indice: number;
}

export interface DiaSemanaGrupo {
  obitos: number;
  dias_calendario: number;
  media_por_dia: number;
  proporcao_observada: number;
  proporcao_esperada_calendario: number;
}

export interface SimDiaSemana {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  periodo: { inicio: string; fim: string };
  total_obitos: number;
  distribuicao: DiaSemanaDistribuicao[];
  fim_de_semana: DiaSemanaGrupo;
  dia_util: DiaSemanaGrupo;
  razao_fim_semana: number | null;
  qui_quadrado: {
    estatistica: number | null;
    gl: number;
    p_valor: number | null;
    significativo_005: boolean | null;
  };
  filtros: Record<string, unknown>;
  notas_metodologicas: string;
}

export interface SimOutlierMunicipio {
  cod_mun_ibge: string;
  municipio: string;
  uf: string;
  ano: number;
  obitos_ano: number;
  populacao: number | null;
  taxa_100mil: number | null;
  meses_com_obito: number;
  share_mes_pico: number;
  share_dia_pico: number;
  classe_concentracao: "evento_unico" | "concentrado" | "difuso";
}

export interface SimOutliers {
  fonte: "SIM";
  dimensao: "ocorrencia" | "residencia";
  municipios: SimOutlierMunicipio[];
  filtros: Record<string, unknown>;
  notas_metodologicas: string;
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

// --- SIM preliminar (camada complementar, isolada da consolidada) ---

export interface AvisoPreliminar {
  preliminar: true;
  data_extracao: string | null;
  completude_estimada: number | null;
  texto: string;
}

export interface SimPrelimSummary {
  fonte: "SIM-PRELIMINAR";
  dimensao: "ocorrencia" | "residencia";
  total_obitos: number;
  municipios: number;
  obitos_por_mes: { competencia: string; total: number }[];
  aviso_preliminar: AvisoPreliminar;
}

export interface SimPrelimMunicipio {
  cod_mun_ibge: string;
  cod_mun_ibge_6: string;
  municipio: string;
  uf: string;
  obitos: number;
  data_extracao: string | null;
}

export interface SimPrelimMunicipios {
  fonte: "SIM-PRELIMINAR";
  dimensao: "ocorrencia" | "residencia";
  page: number;
  page_size: number;
  total: number;
  municipios: SimPrelimMunicipio[];
  aviso_preliminar: AvisoPreliminar;
}

export interface SimPrelimCompletudeMes {
  uf: string | null;
  mes: number;
  obitos_prelim: number | null;
  media_consolidado: number | null;
  completude_estimada: number | null;
}

export interface SimPrelimCompletude {
  fonte: "SIM-PRELIMINAR";
  dimensao: "ocorrencia" | "residencia";
  ano: number;
  uf: string | null;
  por_mes: SimPrelimCompletudeMes[];
  notas_metodologicas: string;
  aviso_preliminar: AvisoPreliminar;
}

export interface SimPrelimDataset {
  id: string;
  layer: string;
  status: "preliminary";
  available: boolean;
  provider?: string;
  grain?: string;
  anos?: number[];
  quality?: { total_obitos: number; linhas: number };
  data_extracao_min?: string | null;
  data_extracao_max?: string | null;
  path?: string;
}

export interface SimPrelimMetadata {
  catalog_version: string;
  scope: string;
  datasets: SimPrelimDataset[];
  aviso_preliminar: AvisoPreliminar;
}
