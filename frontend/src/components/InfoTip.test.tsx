import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InfoTip from "./InfoTip";

describe("InfoTip", () => {
  it("nao abre o popover ate o clique (nao abre no hover)", () => {
    render(<InfoTip termo="taxa_100mil" />);
    fireEvent.mouseOver(screen.getByRole("button", { name: /ajuda/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre ao clicar e mostra os tres blocos na ordem O que mostra / Como ler / Nao permite concluir", () => {
    render(<InfoTip termo="taxa_100mil" />);
    fireEvent.click(screen.getByRole("button", { name: /ajuda/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    const labels = Array.from(dialog.querySelectorAll("dt")).map((el) => el.textContent);
    expect(labels).toEqual(["O que mostra", "Como ler", "Não permite concluir"]);
  });

  it("variante colchete renderiza o gatilho como [?] em vez do icone", () => {
    render(<InfoTip termo="taxa_100mil" variante="colchete" />);
    expect(screen.getByRole("button", { name: /ajuda/i })).toHaveTextContent("[?]");
  });

  it("fecha com Esc e devolve o foco ao botao-gatilho, sem foco preso", () => {
    render(<InfoTip termo="taxa_100mil" />);
    const trigger = screen.getByRole("button", { name: /ajuda/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Abrir nao forca o foco para dentro do dialog (sem trap).
    expect(document.activeElement).not.toBe(screen.getByRole("dialog"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("fecha ao clicar fora do popover", () => {
    render(
      <div>
        <InfoTip termo="taxa_100mil" />
        <div data-testid="fora">fora</div>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /ajuda/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("fora"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fecha ao clicar no botao Fechar dentro do popover", () => {
    render(<InfoTip termo="taxa_100mil" />);
    fireEvent.click(screen.getByRole("button", { name: /ajuda/i }));
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
