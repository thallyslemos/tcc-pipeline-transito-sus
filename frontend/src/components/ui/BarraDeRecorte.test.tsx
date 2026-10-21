import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BarraDeRecorte from "./BarraDeRecorte";

describe("BarraDeRecorte", () => {
  it("renderiza os chips do recorte e o N sempre visivel", () => {
    render(<BarraDeRecorte chips={[{ rotulo: "UF", valor: "BA" }, { rotulo: "Ano", valor: "2024" }]} n={3105} />);
    expect(screen.getByText("UF")).toBeInTheDocument();
    expect(screen.getByText("BA")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText(/N = 3\.105/)).toBeInTheDocument();
  });

  it("botao de link so aparece quando aoClicarLink e informado, e dispara o callback", () => {
    vi.useFakeTimers();
    const { rerender } = render(<BarraDeRecorte chips={[]} n={0} />);
    expect(screen.queryByText("Link do recorte")).not.toBeInTheDocument();

    const aoClicarLink = vi.fn();
    rerender(<BarraDeRecorte chips={[]} n={0} aoClicarLink={aoClicarLink} />);

    const button = screen.getByText("Link do recorte");
    fireEvent.click(button);
    expect(aoClicarLink).toHaveBeenCalledOnce();
    expect(screen.getByText("Copiado!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Link do recorte")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("botao de exportar so aparece quando aoClicarExportar e informado", () => {
    render(<BarraDeRecorte chips={[]} n={0} />);
    expect(screen.queryByText("Exportar")).not.toBeInTheDocument();
  });
});
