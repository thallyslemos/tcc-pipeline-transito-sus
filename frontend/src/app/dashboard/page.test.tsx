import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimSummary,
  fetchSimTipos,
} from "@/lib/api";
import type { SimSummary } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchSimSummary: vi.fn(),
  fetchSimAnos: vi.fn(),
  fetchSimTipos: vi.fn(),
  fetchSimMunicipios: vi.fn(),
}));

const mockSummary: SimSummary = {
  fonte: "SIM",
  dimensao: "ocorrencia",
  total_obitos: 120,
  municipios: 3,
  periodo: "2024-2024",
  obitos_por_ano: [{ ano: 2024, total: 120 }],
  obitos_por_mes: [
    { competencia: "2024-01", total: 50 },
    { competencia: "2024-02", total: 70 },
  ],
  obitos_por_tipo_veiculo: [
    { tipo_veiculo: "Motociclista", total: 70 },
    { tipo_veiculo: "Automovel", total: 50 },
  ],
  obitos_por_faixa_etaria: [
    { faixa_etaria: "25-34", total: 60 },
    { faixa_etaria: "35-44", total: 60 },
  ],
  obitos_por_sexo: [
    { sexo: "Masculino", total: 80 },
    { sexo: "Feminino", total: 30 },
    { sexo: "Ignorado", total: 10 },
  ],
  denominadores: {
    populacao: "disponivel somente quando o municipio/ano existe no IBGE",
    frota: "indisponivel ate validacao do SENATRAN",
  },
};

beforeEach(() => {
  vi.mocked(fetchSimAnos).mockResolvedValue({ dimensao: "ocorrencia", anos: [2024] });
  vi.mocked(fetchSimTipos).mockResolvedValue({ dimensao: "ocorrencia", tipos: ["Automovel"] });
  vi.mocked(fetchSimSummary).mockResolvedValue(mockSummary);
  vi.mocked(fetchSimMunicipios).mockResolvedValue({
    dimensao: "ocorrencia",
    page: 1,
    page_size: 200,
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
});

describe("DashboardPage", () => {
  it("renderiza as metricas globais do SIM", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Evolucao mensal")).toBeInTheDocument();
    });

    expect(screen.getByText("Evolucao anual")).toBeInTheDocument();
    expect(screen.getByText("Obitos por Tipo de Veiculo")).toBeInTheDocument();
    expect(screen.getByText("Obitos por Faixa Etaria")).toBeInTheDocument();
    expect(screen.getByText("Distribuicao por Sexo")).toBeInTheDocument();
    expect(screen.getByText("Ignorado")).toBeInTheDocument();
    expect(screen.getByText("Top 10 Municipios - Obitos")).toBeInTheDocument();
  });
});
