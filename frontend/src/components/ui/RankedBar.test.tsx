import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RankedBar from "./RankedBar";

describe("RankedBar", () => {
  it("ordena os itens por valor decrescente", () => {
    render(
      <RankedBar
        itens={[
          { nome: "Pedestre", valor: 10 },
          { nome: "Motociclista", valor: 50 },
          { nome: "Automovel", valor: 30 },
        ]}
      />
    );
    const nomes = screen.getAllByText(/Pedestre|Motociclista|Automovel/).map((el) => el.textContent);
    expect(nomes).toEqual(["Motociclista", "Automovel", "Pedestre"]);
  });

  it("calcula o percentual de cada item sobre o total", () => {
    render(
      <RankedBar
        itens={[
          { nome: "A", valor: 25 },
          { nome: "B", valor: 75 },
        ]}
      />
    );
    expect(screen.getByText("75,0%")).toBeInTheDocument();
    expect(screen.getByText("25,0%")).toBeInTheDocument();
  });

  it("sem corPorItem, todas as barras ficam neutras (--hairline)", () => {
    const { container } = render(
      <RankedBar
        itens={[
          { nome: "A", valor: 10 },
          { nome: "B", valor: 5 },
        ]}
      />
    );
    const barras = container.querySelectorAll<HTMLElement>("[style*='width']");
    for (const barra of barras) {
      expect(barra.style.backgroundColor).toBe("var(--hairline)");
    }
  });

  it("com corPorItem e enfase padrao (lider), so a barra de maior valor recebe a cor de dado", () => {
    const { container } = render(
      <RankedBar
        itens={[
          { nome: "Motociclista", valor: 50 },
          { nome: "Pedestre", valor: 10 },
        ]}
        corPorItem={() => "var(--cat-moto)"}
      />
    );
    const barras = Array.from(container.querySelectorAll<HTMLElement>("[style*='width']"));
    expect(barras[0].style.backgroundColor).toBe("var(--cat-moto)");
    expect(barras[1].style.backgroundColor).toBe("var(--hairline)");
  });

  it("com enfase='todas', cada barra recebe sua propria cor", () => {
    const { container } = render(
      <RankedBar
        itens={[
          { nome: "Motociclista", valor: 50 },
          { nome: "Pedestre", valor: 10 },
        ]}
        enfase="todas"
        corPorItem={(nome) => (nome === "Motociclista" ? "var(--cat-moto)" : "var(--cat-pedestre)")}
      />
    );
    const barras = Array.from(container.querySelectorAll<HTMLElement>("[style*='width']"));
    expect(barras[0].style.backgroundColor).toBe("var(--cat-moto)");
    expect(barras[1].style.backgroundColor).toBe("var(--cat-pedestre)");
  });
});
