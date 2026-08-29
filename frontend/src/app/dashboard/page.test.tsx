import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";
import {
  fetchSimAnos,
  fetchSimMunicipios,
  fetchSimPopulacaoCobertura,
  fetchSimSummary,
  fetchSimTipos,
} from "@/lib/api";
import type { SimSummary } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchSimSummary: vi.fn(),
  fetchSimAnos: vi.fn(),
  fetchSimTipos: vi.fn(),
  fetchSimMunicipios: vi.fn(),
  fetchSimPopulacaoCobertura: vi.fn(),
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
    frota: "100.0% dos municipios com frota SENATRAN no recorte (estoque de dezembro/2024)",
  },
};

beforeEach(() => {
  vi.mocked(fetchSimAnos).mockResolvedValue({ dimensao: "ocorrencia", anos: [2024] });
  vi.mocked(fetchSimTipos).mockResolvedValue({ dimensao: "ocorrencia", tipos: ["Automovel"] });
  vi.mocked(fetchSimSummary).mockResolvedValue(mockSummary);
  vi.mocked(fetchSimPopulacaoCobertura).mockResolvedValue({
    fonte: "SIM",
    dimensao: "ocorrencia",
    total_municipio_ano: 100,
    exata: 80,
    estimada: 18,
    indisponivel: 2,
    notas_metodologicas: "teste",
  });
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
      expect(screen.getByText(/Total de óbitos por competência mensal do óbito/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Total de óbitos por ano/)).toBeInTheDocument();
    expect(screen.getByText(/Óbitos por tipo de vítima/)).toBeInTheDocument();
    expect(screen.getByText(/Óbitos por faixa etária/)).toBeInTheDocument();
    expect(screen.getByText(/Óbitos por sexo/)).toBeInTheDocument();
    expect(screen.getByText("Ignorado")).toBeInTheDocument();
    expect(screen.getByText(/Os 10 municípios com maior número absoluto/)).toBeInTheDocument();
  });

  it("selecionar 'Todos' no filtro Ano nao e reescrito de volta para o ultimo ano", async () => {
    vi.mocked(fetchSimAnos).mockResolvedValue({ dimensao: "ocorrencia", anos: [2023, 2024] });
    render(<DashboardPage />);

    // Carga inicial: auto-seleciona o ultimo ano (2024).
    await waitFor(() => {
      const ultima = vi.mocked(fetchSimSummary).mock.calls.at(-1)?.[0];
      expect(ultima?.ano).toBe(2024);
    });

    fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "" } });

    // A chamada mais recente deve refletir "Todos" (sem ano).
    await waitFor(() => {
      const ultima = vi.mocked(fetchSimSummary).mock.calls.at(-1)?.[0];
      expect(ultima?.ano).toBeUndefined();
    });

    // Regressao: o useEffect de auto-selecao do ultimo ano nao pode disparar
    // de novo e reescrever ano=2024 depois que o usuario escolheu "Todos".
    await new Promise((resolve) => setTimeout(resolve, 100));
    const ultimaChamada = vi.mocked(fetchSimSummary).mock.calls.at(-1)?.[0];
    expect(ultimaChamada?.ano).toBeUndefined();
  });
});
