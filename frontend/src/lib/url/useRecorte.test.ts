import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

let pathname = "/dashboard";
let searchParams = new URLSearchParams("ano=2025&uf=BA&dimensao=ocorrencia");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
}));

import { useRecorte } from "./useRecorte";

describe("useRecorte", () => {
  beforeEach(() => {
    replace.mockClear();
    sessionStorage.clear();
    pathname = "/dashboard";
    searchParams = new URLSearchParams("ano=2025&uf=BA&dimensao=ocorrencia");
  });

  it("registrarAnosDisponiveis corrige ano invalido para ultimo consolidado", () => {
    const { result } = renderHook(() => useRecorte());

    act(() => {
      result.current.registrarAnosDisponiveis([2010, 2011, 2024]);
    });

    expect(result.current.recorte.ano).toBe(2024);
  });

  it("nao mantem municipio ao navegar para rota agregada", () => {
    searchParams = new URLSearchParams(
      "dimensao=ocorrencia&uf=BA&ano=2024&municipio=2927408"
    );
    pathname = "/ranking";

    const { result } = renderHook(() => useRecorte());

    expect(result.current.recorte.municipio).toBeUndefined();
    expect(result.current.recorte.uf).toBe("BA");
  });

  it("patchRecorte limpa municipio ao trocar UF", () => {
    searchParams = new URLSearchParams(
      "dimensao=ocorrencia&uf=BA&ano=2024&municipio=2927408"
    );
    pathname = "/municipio";

    const { result } = renderHook(() => useRecorte());

    act(() => {
      result.current.patchRecorte({ uf: "SP" });
    });

    expect(result.current.recorte.uf).toBe("SP");
    expect(result.current.recorte.municipio).toBeUndefined();
  });
});
