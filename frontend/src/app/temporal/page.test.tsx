import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TemporalPage from "./page";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimTemporalDiaSemana,
  fetchSimTemporalOutliers,
  fetchSimTemporalSerieMensal,
  fetchSimTipos,
} from "@/lib/api";
import type { SimDiaSemana, SimOutliers, SimSerieMensal } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchSimAnos: vi.fn(),
  fetchSimTipos: vi.fn(),
  fetchSimMunicipios: vi.fn(),
  fetchSimTemporalSerieMensal: vi.fn(),
  fetchSimTemporalDiaSemana: vi.fn(),
  fetchSimTemporalOutliers: vi.fn(),
}));

const mockSerieMensal: SimSerieMensal = {
  fonte: "SIM",
  dimensao: "ocorrencia",
  pontos: [
    { competencia: "2024-01", obitos: 279 },
    { competencia: "2024-02", obitos: 209 },
  ],
  resumo: {
    total_obitos: 488,
    media_mensal: 244,
    desvio_mensal: 35,
    mes_pico: "2024-01",
    share_mes_pico: 0.5717,
    meses_com_obito: 2,
    hhi_mensal: 0.55,
    classe_concentracao: "concentrado",
    alerta: false,
  },
  filtros: {},
  notas_metodologicas: "nota mensal",
};

const mockDiaSemana: SimDiaSemana = {
  fonte: "SIM",
  dimensao: "ocorrencia",
  periodo: { inicio: "2024-01-01", fim: "2024-12-31" },
  total_obitos: 210,
  distribuicao: [
    { dia_semana: 1, dia_semana_nome: "Segunda", obitos: 34, dias_no_calendario: 53, media_por_dia: 0.6415, proporcao_observada: 0.1619, indice: 1.1181 },
    { dia_semana: 2, dia_semana_nome: "Terca", obitos: 26, dias_no_calendario: 53, media_por_dia: 0.4906, proporcao_observada: 0.1238, indice: 0.855 },
    { dia_semana: 3, dia_semana_nome: "Quarta", obitos: 33, dias_no_calendario: 52, media_por_dia: 0.6346, proporcao_observada: 0.1571, indice: 1.106 },
    { dia_semana: 4, dia_semana_nome: "Quinta", obitos: 23, dias_no_calendario: 52, media_por_dia: 0.4423, proporcao_observada: 0.1095, indice: 0.7709 },
    { dia_semana: 5, dia_semana_nome: "Sexta", obitos: 31, dias_no_calendario: 52, media_por_dia: 0.5962, proporcao_observada: 0.1476, indice: 1.039 },
    { dia_semana: 6, dia_semana_nome: "Sabado", obitos: 29, dias_no_calendario: 52, media_por_dia: 0.5577, proporcao_observada: 0.1381, indice: 0.972 },
    { dia_semana: 7, dia_semana_nome: "Domingo", obitos: 34, dias_no_calendario: 52, media_por_dia: 0.6538, proporcao_observada: 0.1619, indice: 1.1396 },
  ],
  fim_de_semana: { obitos: 63, dias_calendario: 104, media_por_dia: 0.6058, proporcao_observada: 0.3, proporcao_esperada_calendario: 0.2842 },
  dia_util: { obitos: 147, dias_calendario: 262, media_por_dia: 0.5611, proporcao_observada: 0.7, proporcao_esperada_calendario: 0.7158 },
  razao_fim_semana: 1.0797,
  qui_quadrado: { estatistica: 3.6151, gl: 6, p_valor: 0.7286, significativo_005: false },
  filtros: {},
  notas_metodologicas: "nota dia da semana",
};

const mockOutliers: SimOutliers = {
  fonte: "SIM",
  dimensao: "ocorrencia",
  municipios: [
    {
      cod_mun_ibge: "291125",
      municipio: "Gaviao",
      uf: "BA",
      ano: 2024,
      obitos_ano: 20,
      populacao: 4493,
      taxa_100mil: 445.14,
      meses_com_obito: 1,
      share_mes_pico: 1.0,
      share_dia_pico: 1.0,
      classe_concentracao: "evento_unico",
    },
  ],
  filtros: {},
  notas_metodologicas: "nota outliers",
};

beforeEach(() => {
  vi.mocked(fetchSimAnos).mockResolvedValue({ dimensao: "ocorrencia", anos: [2023, 2024] });
  vi.mocked(fetchSimTipos).mockResolvedValue({ dimensao: "ocorrencia", tipos: ["Automovel"] });
  vi.mocked(fetchSimMunicipios).mockResolvedValue({
    dimensao: "ocorrencia",
    page: 1,
    page_size: 500,
    total: 1,
    municipios: [
      {
        cod_mun_ibge: "2927401",
        municipio: "Brumado",
        uf: "BA",
        obitos: 120,
        populacao: 100000,
        taxa_obitos_100mil: 120,
        populacao_status: "disponivel",
      },
    ],
  });
  vi.mocked(fetchSimTemporalSerieMensal).mockResolvedValue(mockSerieMensal);
  vi.mocked(fetchSimTemporalDiaSemana).mockResolvedValue(mockDiaSemana);
  vi.mocked(fetchSimTemporalOutliers).mockResolvedValue(mockOutliers);
});

describe("TemporalPage", () => {
  it("renderiza as secoes de serie mensal, dia da semana e outliers", async () => {
    render(<TemporalPage />);

    await waitFor(() => {
      expect(screen.getByText(/Total de óbitos por competência mensal do óbito/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Média de óbitos por dia da semana/)).toBeInTheDocument();
    expect(screen.getByText("Municipios com concentracao temporal (evento unico / concentrado)")).toBeInTheDocument();
    expect(screen.getByText("Gaviao")).toBeInTheDocument();
    expect(screen.getByText("Evento unico")).toBeInTheDocument();
  });

  it("exibe a razao fim de semana / dia util calculada pelo backend", async () => {
    render(<TemporalPage />);

    await waitFor(() => {
      expect(screen.getByText("1.08")).toBeInTheDocument();
    });
  });
});
