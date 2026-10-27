import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
vi.mock("./Sidebar", () => ({ default: () => <nav aria-label="Menu lateral" /> }));

describe("atalho para o conteúdo", () => {
  it("mantém um único atalho e um destino focável após o cabeçalho", () => {
    render(<AppShell><h1>Conteúdo</h1></AppShell>);
    expect(screen.getAllByRole("link", { name: "Pular para o conteúdo principal" })).toHaveLength(1);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link")).toHaveAttribute("href", "#main-content");
  });
});
