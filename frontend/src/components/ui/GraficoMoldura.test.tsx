import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GraficoMoldura from "./GraficoMoldura";

describe("GraficoMoldura", () => {
  it("renderiza a Camada 1 (titulo de medida) e a Camada 2 (nota de metodo), fixas", () => {
    render(
      <GraficoMoldura medidaId="distribuicao_dia_semana">
        <div>o grafico</div>
      </GraficoMoldura>
    );
    expect(screen.getByText(/Média de óbitos por dia da semana/)).toBeInTheDocument();
    expect(screen.getByText(/Denominador de cada dia da semana/)).toBeInTheDocument();
    expect(screen.getByText("o grafico")).toBeInTheDocument();
  });

  it("Camada 3: quando a leitura foi gerada, identifica a regra explicitamente", () => {
    render(
      <GraficoMoldura
        medidaId="serie_mensal_obitos"
        leitura={{ gerado: true, regra: "R1", texto: "A taxa passou de 18,2 em 2010 para 20,3 em 2024." }}
      >
        <div />
      </GraficoMoldura>
    );
    expect(screen.getByText(/A taxa passou de 18,2/)).toBeInTheDocument();
    expect(screen.getByText(/gerado · regra R1/)).toBeInTheDocument();
  });

  it("Camada 3: quando suprimida por guarda, explica o motivo em vez de ficar em branco", () => {
    render(
      <GraficoMoldura
        medidaId="serie_mensal_obitos"
        leitura={{ gerado: false, regra: "G1", texto: "Com 5 óbitos no recorte, a leitura foi suprimida." }}
      >
        <div />
      </GraficoMoldura>
    );
    expect(screen.getByText(/leitura foi suprimida/)).toBeInTheDocument();
    expect(screen.getByText(/suprimido · guarda G1/)).toBeInTheDocument();
  });

  it("mostra o botao [?] so quando termoAjuda e informado, e abre o popover com os 3 blocos", () => {
    const { rerender } = render(
      <GraficoMoldura medidaId="serie_mensal_obitos">
        <div />
      </GraficoMoldura>
    );
    expect(screen.queryByRole("button", { name: /ajuda/i })).not.toBeInTheDocument();

    rerender(
      <GraficoMoldura medidaId="distribuicao_dia_semana" termoAjuda="distribuicao_dia_semana">
        <div />
      </GraficoMoldura>
    );
    const gatilho = screen.getByRole("button", { name: /ajuda/i });
    expect(gatilho).toHaveTextContent("[?]");
    fireEvent.click(gatilho);
    const dialog = screen.getByRole("dialog");
    const labels = Array.from(dialog.querySelectorAll("dt")).map((el) => el.textContent);
    expect(labels).toEqual(["O que mostra", "Como ler", "Não permite concluir"]);
  });

  it("renderiza proveniencia e legenda quando informadas", () => {
    render(
      <GraficoMoldura
        medidaId="serie_mensal_obitos"
        proveniencia="SIM/DATASUS · BA · extração 2026-08-20"
        legenda={<span>legenda customizada</span>}
      >
        <div />
      </GraficoMoldura>
    );
    expect(screen.getByText("SIM/DATASUS · BA · extração 2026-08-20")).toBeInTheDocument();
    expect(screen.getByText("legenda customizada")).toBeInTheDocument();
  });
});
