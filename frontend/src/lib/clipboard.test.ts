import { afterEach, describe, expect, it, vi } from "vitest";
import { copiarLinkDoRecorte } from "./clipboard";
afterEach(() => vi.unstubAllGlobals());
describe("copiarLinkDoRecorte", () => {
  it("copia exatamente a URL do recorte", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copiarLinkDoRecorte();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
  it("rejeita quando clipboard está indisponível", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copiarLinkDoRecorte()).rejects.toThrow();
  });
  it("propaga a falha do navegador", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("bloqueado")) } });
    await expect(copiarLinkDoRecorte()).rejects.toThrow("bloqueado");
  });
});
