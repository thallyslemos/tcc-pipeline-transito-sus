/** Rejeita ausência/permissão negada para que a interface não anuncie sucesso falso. */
export async function copiarLinkDoRecorte(): Promise<void> {
  if (typeof window === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
    throw new Error("Área de transferência indisponível neste navegador.");
  }
  await navigator.clipboard.writeText(window.location.href);
}
