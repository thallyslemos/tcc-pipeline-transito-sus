import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditoriaPage from "./page";

const payload = {
  source: {
    files_observed: 2,
    files_canonical: 1,
    duplicate_files_removed: 1,
    relative_root: "data/bronze/sim_parts",
  },
  anchors: [],
  annual: [{
    ano: 2024,
    ocorrencia_brasil_deduplicada: 37_150,
    ocorrencia_brasil_com_copias: 78_234,
    excesso_por_copias: 41_084,
    ocorrencia_ba_deduplicada: 3_105,
    residencia_ba_deduplicada: 3_041,
    onsv_publicado: 37_150,
    status_reconciliacao: "reproduzido_localmente",
  }],
  methodologies: [{
    id: "onsv_2024",
    label: "ONSV — publicação DATASUS 2024",
    geography: "Município de ocorrência (CODMUNOCOR), Brasil",
    time_field: "DTOBITO",
    cid_rule: "V0–V8",
    sex_rule: "SEXO",
    age_rule: "IDADE",
    acquisition: "SIM-DOEXT",
    source: { publication_url: "https://www.onsv.org.br/estudos/analise-datasus-2024" },
  }],
  interpretation: ["A publicação ONSV é por ocorrência no Brasil."],
};

describe("AuditoriaPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exibe a comparação deduplicada e o excesso por cópias", async () => {
    render(<AuditoriaPage />);

    expect(await screen.findByTestId("audit-page")).toBeInTheDocument();
    expect(screen.getByTestId("onsv-anchor-2024")).toHaveTextContent("37.150");
    expect(screen.getByTestId("local-deduplicated-2024")).toHaveTextContent("37.150");
    expect(screen.getByTestId("legacy-2024")).toHaveTextContent("78.234");
    expect(screen.getByText("Município de ocorrência (CODMUNOCOR), Brasil")).toBeInTheDocument();
  });
});
