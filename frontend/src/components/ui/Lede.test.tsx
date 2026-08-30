import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Lede from "./Lede";

describe("Lede", () => {
  it("mostra o texto gerado e identifica a regra", () => {
    render(
      <Lede
        rotulo="Panorama"
        leitura={{ gerado: true, regra: "R1", texto: "A taxa passou de 18,2 em 2010 para 20,3 em 2024." }}
      />
    );
    expect(screen.getByText(/A taxa passou de 18,2/)).toBeInTheDocument();
    expect(screen.getByText(/gerado · regra R1/)).toBeInTheDocument();
  });

  it("quando suprimida por guarda, explica o motivo em vez de ficar em branco", () => {
    render(
      <Lede
        rotulo="Panorama"
        leitura={{ gerado: false, regra: "G2", texto: "100,0% dos óbitos ocorreram num único dia." }}
      />
    );
    expect(screen.getByText(/100,0% dos óbitos/)).toBeInTheDocument();
    expect(screen.getByText(/suprimido · guarda G2/)).toBeInTheDocument();
  });

  it("quando nao ha leitura nenhuma (null), mostra fallback explicito, nunca fica em branco", () => {
    render(<Lede rotulo="Panorama" leitura={null} />);
    expect(screen.getByText(/Sem leitura automática disponível/)).toBeInTheDocument();
  });
});
