import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function apiUrl(): string {
  const raw =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

/** Injeta a URL da API no browser em runtime (nao embutida no bundle). */
export function GET() {
  const body = `window.__API_URL__=${JSON.stringify(apiUrl())};`;
  return new NextResponse(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
