import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SeloQualidade from "./SeloQualidade";

describe("SeloQualidade", () => {
  it("expõe o texto do motivo via title e aria-label (nunca só ícone mudo)", () => {
    render(<SeloQualidade entrada={{ motivo: "frota_ausente" }} />);
    const selo = screen.getByLabelText(/Frota SENATRAN não pareada/);
    expect(selo).toBeInTheDocument();
    expect(selo).toHaveAttribute("title");
  });

  it("motivo populacao_estimada inclui o ano de referência no texto", () => {
    render(<SeloQualidade entrada={{ motivo: "populacao_estimada", anoReferencia: 2022, defasagemAnos: 2 }} />);
    expect(screen.getByLabelText(/ano 2022/)).toBeInTheDocument();
  });
});
