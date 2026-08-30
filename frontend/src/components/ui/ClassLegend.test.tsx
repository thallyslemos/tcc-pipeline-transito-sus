import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ClassLegend from "./ClassLegend";

describe("ClassLegend", () => {
  it("mostra os 5 rotulos de classe com os limites fixos corretos", () => {
    render(<ClassLegend isDark={false} />);
    expect(screen.getByText("< 12,0")).toBeInTheDocument();
    expect(screen.getByText("12,0 – 18,0")).toBeInTheDocument();
    expect(screen.getByText("18,0 – 26,0")).toBeInTheDocument();
    expect(screen.getByText("26,0 – 39,0")).toBeInTheDocument();
    expect(screen.getByText("≥ 39,0")).toBeInTheDocument();
  });

  it("mostra a caixa hachurada de sem dado, nunca branco/vazio", () => {
    render(<ClassLegend isDark={false} />);
    expect(screen.getByText("Sem dado")).toBeInTheDocument();
  });
});
