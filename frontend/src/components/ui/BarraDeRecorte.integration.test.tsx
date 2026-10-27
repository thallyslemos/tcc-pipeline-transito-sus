import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BarraDeRecorte from "./BarraDeRecorte";

describe("confirmação de cópia do recorte", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("aguarda a cópia e bloqueia cliques concorrentes antes de anunciar sucesso", async () => {
    let concluir!: () => void;
    const copiar = vi.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    render(<BarraDeRecorte chips={[]} n={0} aoClicarLink={copiar} />);
    const button = screen.getByRole("button", { name: "Link do recorte" });
    fireEvent.click(button); fireEvent.click(button);
    expect(copiar).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(screen.queryByText("Copiado!")).not.toBeInTheDocument();
    await act(async () => concluir());
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Link do recorte copiado.");
  });
  it("informa falha e permite nova tentativa sem falso sucesso", async () => {
    const copiar = vi.fn().mockRejectedValueOnce(new Error("negado")).mockResolvedValue(undefined);
    render(<BarraDeRecorte chips={[]} n={0} aoClicarLink={copiar} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.queryByText("Copiado!")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Não foi possível copiar");
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByText("Copiado!")).toBeInTheDocument();
  });
  it("reinicia o prazo de dois segundos após nova cópia", async () => {
    render(<BarraDeRecorte chips={[]} n={0} aoClicarLink={vi.fn().mockResolvedValue(undefined)} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(1500));
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText("Copiado!")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText("Link do recorte")).toBeInTheDocument();
  });
  it("limpa o temporizador ao desmontar", async () => {
    const { unmount } = render(<BarraDeRecorte chips={[]} n={0} aoClicarLink={vi.fn().mockResolvedValue(undefined)} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(vi.getTimerCount()).toBe(1);
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it("não agenda atualização se a cópia terminar depois de desmontar", async () => {
    let concluir!: () => void;
    const { unmount } = render(<BarraDeRecorte chips={[]} n={0} aoClicarLink={() => new Promise<void>((resolve) => { concluir = resolve; })} />);
    fireEvent.click(screen.getByRole("button")); unmount();
    await act(async () => concluir()); expect(vi.getTimerCount()).toBe(0);
  });
});
