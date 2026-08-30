/**
 * URL da API FastAPI.
 *
 * Nao use NEXT_PUBLIC_API_URL no bundle de producao: o Next inlinha
 * NEXT_PUBLIC_* no build. Em Docker/Cloud a URL vem em runtime via
 * window.__API_URL__ (script /runtime-config lido do env API_URL).
 */

declare global {
  interface Window {
    __API_URL__?: string;
  }
}

const DEFAULT_API_URL = "http://localhost:8000";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const injected = window.__API_URL__;
    if (typeof injected === "string" && injected.trim()) {
      return stripTrailingSlash(injected.trim());
    }
  }
  const fromEnv =
    (typeof process !== "undefined" &&
      (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL)) ||
    "";
  if (fromEnv.trim()) {
    return stripTrailingSlash(fromEnv.trim());
  }
  return DEFAULT_API_URL;
}
