"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FilterValues } from "@/lib/types";
import {
  hrefComRecorte,
  lerRecorteDaUrl,
  lerRecorteNucleo,
  lerRecorteSession,
  salvarRecorteSession,
  serializarRecorte,
} from "@/lib/url/recorte";

const PRELIM_ANO_MIN = 2025;

function recorteInicial(
  searchParams: URLSearchParams,
  defaults?: Partial<FilterValues>
): FilterValues {
  const daUrl = lerRecorteDaUrl(searchParams);
  if (Object.keys(daUrl).length > 0) {
    return { dimensao: "ocorrencia", ...defaults, ...daUrl };
  }
  const daSession = lerRecorteSession();
  if (Object.keys(daSession).length > 0) {
    return { dimensao: "ocorrencia", ...defaults, ...daSession };
  }
  return { dimensao: "ocorrencia", ...defaults };
}

function normalizarPreliminares(recorte: FilterValues): FilterValues {
  if (recorte.ano != null && recorte.ano < PRELIM_ANO_MIN) {
    return { ...recorte, ano: PRELIM_ANO_MIN };
  }
  return recorte;
}

/**
 * Estado compartilhado de recorte (dimensao, uf, ano, municipio + extras da pagina).
 * Sincroniza URL <-> sessionStorage; paginas extras (regiao, tipo_veiculo) transitam
 * pela URL mas nao entram no nucleo da sidebar.
 */
export function useRecorte(defaults?: Partial<FilterValues>, opcoes?: { preliminares?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionRestaurada = useRef(false);

  const [recorte, setRecorteState] = useState<FilterValues>(() =>
    opcoes?.preliminares ? normalizarPreliminares(recorteInicial(searchParams, defaults)) : recorteInicial(searchParams, defaults)
  );

  // Primeira visita sem query: restaura sessionStorage na URL.
  useEffect(() => {
    if (sessionRestaurada.current) return;
    sessionRestaurada.current = true;
    const daUrl = lerRecorteNucleo(searchParams);
    if (Object.keys(daUrl).length > 0) return;
    const daSession = lerRecorteSession();
    if (Object.keys(daSession).length === 0) return;
    const merged = opcoes?.preliminares
      ? normalizarPreliminares({ dimensao: "ocorrencia", ...defaults, ...daSession })
      : ({ dimensao: "ocorrencia" as const, ...defaults, ...daSession } satisfies FilterValues);
    const query = serializarRecorte(merged).toString();
    if (query) router.replace(`${pathname}?${query}`, { scroll: false });
  }, [defaults, opcoes?.preliminares, pathname, router, searchParams]);

  useEffect(() => {
    const query = serializarRecorte(recorte).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    salvarRecorteSession(recorte);
  }, [recorte, pathname, router]);

  const setRecorte = useCallback((next: FilterValues | ((prev: FilterValues) => FilterValues)) => {
    setRecorteState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return opcoes?.preliminares ? normalizarPreliminares(resolved) : resolved;
    });
  }, [opcoes?.preliminares]);

  const patchRecorte = useCallback(
    (patch: Partial<FilterValues>) => {
      setRecorte((current) => {
        const next: FilterValues = { ...current, ...patch };
        if (patch.uf !== undefined && patch.uf !== current.uf && patch.municipio === undefined) {
          next.municipio = undefined;
        }
        if (patch.regiao) {
          next.uf = undefined;
        }
        if (patch.uf) {
          next.regiao = undefined;
        }
        return next;
      });
    },
    [setRecorte]
  );

  const hrefWithRecorte = useCallback((path: string) => hrefComRecorte(path, recorte), [recorte]);

  return { recorte, setRecorte, patchRecorte, hrefWithRecorte };
}

/** Hook leve para a Sidebar: le recorte atual da URL ou sessionStorage. */
export function useRecorteParaNavegacao(): Partial<FilterValues> {
  const searchParams = useSearchParams();
  const [nucleo, setNucleo] = useState<Partial<FilterValues>>(() => {
    const daUrl = lerRecorteNucleo(searchParams);
    if (Object.keys(daUrl).length > 0) return daUrl;
    return lerRecorteSession();
  });

  useEffect(() => {
    const daUrl = lerRecorteNucleo(searchParams);
    if (Object.keys(daUrl).length > 0) {
      setNucleo(daUrl);
      return;
    }
    setNucleo(lerRecorteSession());
  }, [searchParams]);

  return nucleo;
}
