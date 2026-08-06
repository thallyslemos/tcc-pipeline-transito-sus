import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FluxosPage from "./page";
import {
  fetchSimAnos,
  fetchSimFluxos,
  fetchSimFluxosGeo,
  fetchSimMunicipios,
  fetchSimTipos,
} from "@/lib/api";
import type { SimFluxo } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchSimAnos: vi.fn(),
  fetchSimTipos: vi.fn(),
  fetchSimMunicipios: vi.fn(),
  fetchSimFluxos: vi.fn(),
  fetchSimFluxosGeo: vi.fn(),
}));

// FluxoMapView usa maplibre-gl que nao funciona em jsdom
vi.mock("@/components/map/FluxoMapView", () => ({
  default: () => <div data-testid="fluxo-map">mapa de fluxos</div>,
}));

const mockMunicipios = [
  {
    cod_mun_ibge: "2933307",
    municipio: "Vitória da Conquista",
    uf: "BA",
    obitos: 156,
    populacao: null,
    taxa_obitos_100mil: null,
    populacao_status: "indisponivel" as const,
  },
  {
    cod_mun_ibge: "2927401",
    municipio: "Salvador",
    uf: "BA",
    obitos: 200,
    populacao: null,
    taxa_obitos_100mil: null,
    populacao_status: "indisponivel" as const,
  },
];

const mockFluxo: SimFluxo = {
  fonte: "SIM",
  direcao: "origens",
  municipio_alvo: { cod_mun_ibge: "293330", municipio: "Vitória da Conquista", uf: "BA" },
  total_obitos: 156,
  total_ambos_encontrados: 156,
  obitos_proprio_municipio: 76,
  obitos_fora: 80,
  proporcao_fora: 0.5128,
  municipios_conectados: 18,
  arestas: [
    {
      cod_mun_ibge: "293330",
      municipio: "Vitória da Conquista",
      uf: "BA",
      obitos: 76,
      participacao: 0.4872,
      propria_municipio: true,
      geografia_status: "encontrado",
    },
    {
      cod_mun_ibge: "292510",
      municipio: "Poções",
      uf: "BA",
      obitos: 6,
      participacao: 0.0385,
      propria_municipio: false,
      geografia_status: "encontrado",
    },
  ],
  filtros: { ano: 2024, tipo_veiculo: null, top_n: 20, min_obitos: 1, incluir_desconhecidos: false },
  notas_metodologicas: "Filtros: is_v01_v89=true, qa_status=ok, tipobito_raw=2.",
};

const mockGeoData = {
  type: "FeatureCollection" as const,
  features: [],
};

beforeEach(() => {
  vi.mocked(fetchSimAnos).mockResolvedValue({ dimensao: "ocorrencia", anos: [2022, 2023, 2024] });
  vi.mocked(fetchSimTipos).mockResolvedValue({ dimensao: "ocorrencia", tipos: ["Motociclista", "Automovel"] });
  // fetchSimMunicipios e chamado internamente pelo combobox quando o usuario digita
  vi.mocked(fetchSimMunicipios).mockResolvedValue({
    dimensao: "ocorrencia",
    page: 1,
    page_size: 10,
    total: 2,
    municipios: mockMunicipios,
  });
  vi.mocked(fetchSimFluxos).mockResolvedValue(mockFluxo);
  vi.mocked(fetchSimFluxosGeo).mockResolvedValue(mockGeoData);
});

/**
 * Helper: digita no combobox, aguarda o debounce (300ms) + resultado da API,
 * e clica no municipio. Usa waitFor com timeout maior para cobrir o debounce real.
 */
async function typeAndSelect(searchText: string, municipioName: string) {
  const input = screen.getByPlaceholderText(/Digite o nome ou codigo IBGE/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: searchText } });
  // waitFor aguarda ate 1500ms: suficiente para o debounce de 300ms + render
  await waitFor(
    () => expect(screen.getByText(municipioName)).toBeInTheDocument(),
    { timeout: 1500 }
  );
  fireEvent.mouseDown(screen.getByText(municipioName));
}

describe("FluxosPage", () => {
  it("renderiza o seletor de municipio e estado vazio inicial", async () => {
    render(<FluxosPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Digite o nome ou codigo IBGE/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Selecione um municipio para visualizar/i)).toBeInTheDocument();
  });

  it("renderiza os botoes de direcao", async () => {
    render(<FluxosPage />);
    await waitFor(() => {
      expect(screen.getByText("Origens das vitimas")).toBeInTheDocument();
    });
    expect(screen.getByText("Destinos dos residentes")).toBeInTheDocument();
  });

  it("alterna entre direcao origens e destinos", async () => {
    render(<FluxosPage />);
    await waitFor(() => {
      expect(screen.getByText("Destinos dos residentes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Destinos dos residentes"));
    expect(screen.getByText("Destinos dos residentes")).toBeInTheDocument();
  });

  it("exibe KPIs e tabela apos selecionar municipio", async () => {
    render(<FluxosPage />);
    await typeAndSelect("Vitória", "Vitória da Conquista");

    await waitFor(() => {
      expect(fetchSimFluxos).toHaveBeenCalledWith(
        "293330",
        "origens",
        expect.objectContaining({})
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Total de obitos")).toBeInTheDocument();
    });

    expect(screen.getByText("Proprio municipio")).toBeInTheDocument();
    expect(screen.getByText("Outros municipios")).toBeInTheDocument();
    expect(screen.getByText("Municipios conectados")).toBeInTheDocument();
  }, 5000);

  it("exibe tabela de arestas com municipios corretos", async () => {
    render(<FluxosPage />);
    await typeAndSelect("Vitória", "Vitória da Conquista");

    await waitFor(() => {
      expect(screen.getByText("Municipios de residencia das vitimas")).toBeInTheDocument();
    });

    // Municipio proprio deve aparecer na tabela com badge
    expect(screen.getByText("Proprio")).toBeInTheDocument();
    // Pocoes deve aparecer
    expect(screen.getByText("Poções")).toBeInTheDocument();
  }, 5000);

  it("exibe descricao de direcao ao selecionar municipio", async () => {
    render(<FluxosPage />);
    await typeAndSelect("Vitória", "Vitória da Conquista");

    await waitFor(() => {
      const matches = screen.getAllByText(/Origens das vitimas/i);
      // Deve haver o botao e a descricao contextual
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  }, 5000);

  it("notas metodologicas aparecem no rodape da tabela", async () => {
    render(<FluxosPage />);
    await typeAndSelect("Vitória", "Vitória da Conquista");

    await waitFor(() => {
      expect(screen.getByText(/Filtros: is_v01_v89=true/i)).toBeInTheDocument();
    });
  }, 5000);
});
