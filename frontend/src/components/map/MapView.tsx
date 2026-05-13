"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrency, formatNumber, formatTaxa100k } from "@/lib/format";
import { MAP_NEUTRAL_COLOR, mapChoroplethRgb } from "@/lib/mapGradient";
import type { MapPoint } from "@/lib/types";
import MapLegend, { type MapScaleMode } from "@/components/map/MapLegend";

interface Props {
  data: MapPoint[];
  metrica: string;
  dimensao?: string;
  ano?: number;
  uf?: string;
  regiao?: string;
  escala: MapScaleMode;
}

function tileUrl(isDark: boolean): string[] {
  const base = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";
  return ["a", "b", "c", "d"].map((s) => base.replace("{s}", s));
}

function initStyle(isDark: boolean): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: tileUrl(isDark),
        tileSize: 256,
        attribution: "&copy; CARTO &copy; OpenStreetMap",
      },
    },
    layers: [{ id: "carto-tiles", type: "raster", source: "carto" }],
  };
}

function primaryVisual(
  p: Record<string, unknown>,
  metrica: string,
  escala: MapScaleMode
): number | null {
  if (escala === "total") {
    const v = p.valor;
    return typeof v === "number" ? v : null;
  }
  if (metrica === "custos") {
    const c = p.custo_per_capita;
    return typeof c === "number" && c > 0 ? c : null;
  }
  const r = p.taxa_obitos_100mil;
  return typeof r === "number" && r > 0 ? r : null;
}

function primaryFromMapPoint(
  d: MapPoint,
  metrica: string,
  escala: MapScaleMode
): number | null {
  if (escala === "total") {
    return typeof d.valor === "number" ? d.valor : null;
  }
  if (metrica === "custos") {
    const c = d.custo_per_capita;
    return typeof c === "number" && c > 0 ? c : null;
  }
  const r = d.taxa_obitos_100mil;
  return typeof r === "number" && r > 0 ? r : null;
}

function buildCircleGeoJSON(
  data: MapPoint[],
  metrica: string,
  escala: MapScaleMode,
  isDark: boolean,
  minV: number,
  maxV: number
): GeoJSON.FeatureCollection {
  const valid = data.filter((d) => d.lat != null && d.lon != null);
  const span = maxV - minV || 1;

  return {
    type: "FeatureCollection",
    features: valid.map((d) => {
      const pv = primaryFromMapPoint(d, metrica, escala);
      const ok =
        pv != null && (escala === "total" ? pv >= 0 : pv > 0);
      const ratio = ok ? Math.max(0, Math.min(1, (pv! - minV) / span)) : 0;
      const color = ok ? mapChoroplethRgb(ratio, isDark) : MAP_NEUTRAL_COLOR;
      const radiusBase = ok ? ratio : 0;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [d.lon!, d.lat!] },
        properties: {
          municipio: d.municipio,
          uf: d.uf,
          valor: d.valor,
          atendimentos: d.atendimentos ?? 0,
          populacao: d.populacao,
          taxa_obitos_100mil: d.taxa_obitos_100mil,
          custo_per_capita: d.custo_per_capita,
          color,
          radius: 7 + radiusBase * 26,
        },
      };
    }),
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MapView({
  data,
  metrica,
  dimensao,
  ano,
  uf,
  regiao,
  escala,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const layerReady = useRef(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mode, setMode] = useState<"circles" | "polygons">("polygons");
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const visualExtent = useMemo(() => {
    const collectPoly = () => {
      const feats = geoData?.features ?? [];
      const vals: number[] = [];
      for (const f of feats) {
        const p = (f.properties || {}) as Record<string, unknown>;
        const v = primaryVisual(p, metrica, escala);
        if (v == null) continue;
        if (escala === "relative" && v <= 0) continue;
        vals.push(v);
      }
      return vals;
    };
    const collectCircles = () => {
      const vals: number[] = [];
      for (const d of data) {
        const v = primaryFromMapPoint(d, metrica, escala);
        if (v == null) continue;
        if (escala === "relative" && v <= 0) continue;
        vals.push(v);
      }
      return vals;
    };

    const vals =
      mode === "polygons" && geoData?.features?.length ? collectPoly() : collectCircles();
    if (!vals.length) {
      return { minV: 0, maxV: 0, relativeCount: 0 };
    }
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    return {
      minV,
      maxV: minV === maxV ? minV + 1e-6 : maxV,
      relativeCount: vals.length,
    };
  }, [data, geoData, metrica, escala, mode]);

  useEffect(() => {
    const params = new URLSearchParams({ metrica });
    if (dimensao) params.set("dimensao", dimensao);
    if (ano) params.set("ano", String(ano));
    if (uf) params.set("uf", uf);
    if (regiao) params.set("regiao", regiao);
    fetch(`${API_URL}/api/geo/municipios?${params}`)
      .then((r) => r.json())
      .then((fc) => {
        const hasPolygons = fc.features?.some(
          (f: GeoJSON.Feature) =>
            f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
        );
        setGeoData(fc);
        if (!hasPolygons) setMode("circles");
      })
      .catch(() => setMode("circles"));
  }, [metrica, dimensao, ano, uf, regiao]);

  const isCustos = metrica === "custos";
  const fmt = useCallback(
    (v: number) => (isCustos ? formatCurrency(v) : formatNumber(v)),
    [isCustos]
  );

  const popupHtml = useCallback(
    (p: Record<string, unknown>) => {
      const atend = p.atendimentos
        ? `<br/><span style="opacity:.7">Atendimentos:</span> <b>${formatNumber(Number(p.atendimentos))}</b>`
        : "";
      const pop =
        p.populacao != null && Number(p.populacao) > 0
          ? `<br/><span style="opacity:.7">População:</span> <b>${formatNumber(Number(p.populacao))}</b>`
          : "";
      let rel = "";
      if (metrica !== "custos" && p.taxa_obitos_100mil != null) {
        rel = `<br/><span style="opacity:.7">Taxa:</span> <b>${formatTaxa100k(Number(p.taxa_obitos_100mil))}</b> / 100 mil hab.`;
      } else if (metrica === "custos" && p.custo_per_capita != null) {
        rel = `<br/><span style="opacity:.7">Per capita:</span> <b>${formatCurrency(Number(p.custo_per_capita))}</b>`;
      }
      const cust = modeRef.current === "circles" ? isCustos : isCustos;
      return `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">
            <b style="font-size:13px">${p.municipio}</b>
            <span style="opacity:.6;margin-left:4px">${p.uf}</span><br/>
            <span style="opacity:.7">${cust ? "Custo" : "Óbitos"}:</span> <b>${fmt(Number(p.valor))}</b>${atend}${pop}${rel}
          </div>`;
    },
    [fmt, isCustos, metrica]
  );

  const setupPopup = useCallback(
    (map: maplibregl.Map, layerId: string) => {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
      map.on("mousemove", layerId, (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, unknown>;
        popupRef.current?.setLngLat(e.lngLat).setHTML(popupHtml(p)).addTo(map);
      });
    },
    [popupHtml]
  );

  const addLayers = useCallback(
    (map: maplibregl.Map) => {
      ["pontos-circle", "poly-fill", "poly-outline"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ["pontos", "polygons"].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });

      const { minV, maxV } = visualExtent;
      const span = maxV - minV || 1;

      if (modeRef.current === "polygons" && geoData) {
        const enriched: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: geoData.features.map((f) => {
            const p = (f.properties || {}) as Record<string, unknown>;
            const pv = primaryVisual(p, metrica, escala);
            const ok =
              pv != null && (escala === "total" ? pv >= 0 : pv > 0);
            const ratio = ok ? Math.max(0, Math.min(1, (pv! - minV) / span)) : 0;
            const fillColor = ok ? mapChoroplethRgb(ratio, isDark) : MAP_NEUTRAL_COLOR;
            return {
              ...f,
              properties: {
                ...p,
                fillColor,
              },
            };
          }),
        };

        map.addSource("polygons", { type: "geojson", data: enriched });
        map.addLayer({
          id: "poly-fill",
          type: "fill",
          source: "polygons",
          paint: {
            "fill-color": ["get", "fillColor"],
            "fill-opacity": 0.90,
          },
        });
        setupPopup(map, "poly-fill");
      } else {
        const geojson = buildCircleGeoJSON(
          data,
          metrica,
          escala,
          isDark,
          minV,
          maxV
        );
        map.addSource("pontos", { type: "geojson", data: geojson });
        map.addLayer({
          id: "pontos-circle",
          type: "circle",
          source: "pontos",
          paint: {
            "circle-radius": ["get", "radius"],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.52,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": ["get", "color"],
            "circle-stroke-opacity": 0.9,
          },
        });
        setupPopup(map, "pontos-circle");
      }
      layerReady.current = true;
    },
    [
      data,
      geoData,
      setupPopup,
      metrica,
      escala,
      isDark,
      visualExtent,
    ]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initStyle(isDark),
      center: [-49.5, -14.5],
      zoom: 3.8,
      pitchWithRotate: true,
      dragRotate: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "280px",
    });
    map.on("load", () => addLayers(map));
    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      layerReady.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("carto") as maplibregl.RasterTileSource | undefined)?.setTiles(
      tileUrl(isDark)
    );
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addLayers(map);
  }, [mode, geoData, data, metrica, escala, isDark, addLayers]);

  const hasPolygons = geoData?.features?.some(
    (f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hasPolygons && (
        <div
          className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg"
          style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <button
            type="button"
            onClick={() => setMode("polygons")}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: mode === "polygons" ? "var(--primary)" : "var(--bg-card)",
              color: mode === "polygons" ? "var(--primary-fg)" : "var(--fg-secondary)",
            }}
          >
            Polígonos
          </button>
          <button
            type="button"
            onClick={() => setMode("circles")}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: mode === "circles" ? "var(--primary)" : "var(--bg-card)",
              color: mode === "circles" ? "var(--primary-fg)" : "var(--fg-secondary)",
              borderLeft: "1px solid var(--border)",
            }}
          >
            Círculos
          </button>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-10 max-w-[min(100%,280px)]">
        <MapLegend
          metrica={metrica}
          escala={escala}
          minV={visualExtent.minV}
          maxV={visualExtent.maxV}
          relativeCount={visualExtent.relativeCount}
        />
      </div>
    </div>
  );
}
