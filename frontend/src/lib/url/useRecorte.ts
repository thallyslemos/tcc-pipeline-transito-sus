"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FilterValues } from "@/lib/types";
import {
  hrefComRecorte,
  lerRecorteDaUrl,
  lerRecorteNucleo,
  lerRecorteSession,
  recorteParaRota,
  recortesEquivalentes,
  salvarRecorteSession,
  serializarRecorte,
} from "@/lib/url/recorte";

function recorteInicial(
  searchParams: URLSearchParams,
  pathname: string,
  defaults?: Partial<FilterValues>
): FilterValues {
  const daUrl = lerRecorteDaUrl(searchParams);
  if (Object.keys(daUrl).length > 0) {
    return recorteParaRota(pathname, { dimensao: "ocorrencia", ...defaults, ...daUrl });
  }
  const daSession = lerRecorteSession();
  if (Object.keys(daSession).length > 0) {
    return recorteParaRota(pathname, { dimensao: "ocorrencia", ...defaults, ...daSession });
  }
  return recorteParaRota(pathname, { dimensao: "ocorrencia", ...defaults });
}

/**
 * Estado compartilhado de recorte (dimensao, uf, ano, municipio + extras da pagina).
 * Sincroniza URL <-> sessionStorage; paginas extras (regiao, tipo_veiculo) transitam
 * pela URL mas nao entram no nucleo da sidebar.
 */
export function useRecorte(defaults?: Partial<FilterValues>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionRestaurada = useRef(false);
  const anosDisponiveisRef = useRef<number[]>([]);
  const ignorarProximaUrl = useRef(false);

  const [recorte, setRecorteState] = useState<FilterValues>(() =>
    recorteInicial(searchParams, pathname, defaults)
  );

  const aplicarPolitica = useCallback(
    (base: FilterValues): FilterValues =>
      recorteParaRota(pathname, base, anosDisponiveisRef.current),
    [pathname]
  );

  // Primeira visita sem query: restaura sessionStorage na URL.
  useEffect(() => {
    if (sessionRestaurada.current) return;
    sessionRestaurada.current = true;
    const daUrl = lerRecorteNucleo(searchParams);
    if (Object.keys(daUrl).length > 0) return;
    const daSession = lerRecorteSession();
    if (Object.keys(daSession).length === 0) return;
    const merged = aplicarPolitica({ dimensao: "ocorrencia", ...defaults, ...daSession });
    ignorarProximaUrl.current = true;
    setRecorteState(merged);
  }, [aplicarPolitica, defaults, searchParams]);

  // URL externa (back/forward, link colado) -> estado.
  useEffect(() => {
    if (ignorarProximaUrl.current) {
      ignorarProximaUrl.current = false;
      return;
    }
    const daUrl = lerRecorteDaUrl(searchParams);
    const merged = aplicarPolitica({ dimensao: "ocorrencia", ...defaults, ...daUrl });
    setRecorteState((prev) => (recortesEquivalentes(prev, merged) ? prev : merged));
  }, [aplicarPolitica, defaults, searchParams]);

  // Mudanca de rota: reaplica politica (ex.: strip municipio ao ir para dashboard).
  useEffect(() => {
    setRecorteState((prev) => {
      const next = aplicarPolitica(prev);
      return recortesEquivalentes(prev, next) ? prev : next;
    });
  }, [aplicarPolitica]);

  // Estado -> URL + sessionStorage.
  useEffect(() => {
    const query = serializarRecorte(recorte).toString();
    const atual = searchParams.toString();
    if (query !== atual) {
      ignorarProximaUrl.current = true;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
    salvarRecorteSession(recorte);
  }, [recorte, pathname, router, searchParams]);

  const setRecorte = useCallback(
    (next: FilterValues | ((prev: FilterValues) => FilterValues)) => {
      setRecorteState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        return aplicarPolitica(resolved);
      });
    },
    [aplicarPolitica]
  );

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

  /** Chamar apos fetchSimAnos para validar ano contra catalogo consolidado. */
  const registrarAnosDisponiveis = useCallback(
    (anos: number[]) => {
      anosDisponiveisRef.current = anos;
      setRecorteState((prev) => {
        const next = aplicarPolitica(prev);
        return recortesEquivalentes(prev, next) ? prev : next;
      });
    },
    [aplicarPolitica]
  );

  const hrefWithRecorte = useCallback((path: string) => hrefComRecorte(path, recorte), [recorte]);

  return { recorte, setRecorte, patchRecorte, hrefWithRecorte, registrarAnosDisponiveis };
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
