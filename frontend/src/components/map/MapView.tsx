"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { MapPoint } from "@/lib/types";

interface Props {
  data: MapPoint[];
  metrica: string;
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

function getColor(ratio: number): string {
  if (ratio > 0.8) return "#991b1b";
  if (ratio > 0.6) return "#dc2626";
  if (ratio > 0.4) return "#f97316";
  if (ratio > 0.2) return "#facc15";
  return "#4ade80";
}

function getRadius(ratio: number): number {
  return 6 + ratio * 28;
}

function buildCircleGeoJSON(data: MapPoint[]): GeoJSON.FeatureCollection {
  const valid = data.filter((d) => d.lat != null && d.lon != null);
  const max = Math.max(...valid.map((d) => d.valor), 1);
  return {
    type: "FeatureCollection",
    features: valid.map((d) => {
      const ratio = d.valor / max;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [d.lon!, d.lat!] },
        properties: {
          municipio: d.municipio, uf: d.uf, valor: d.valor,
          atendimentos: d.atendimentos ?? 0,
          color: getColor(ratio), radius: getRadius(ratio),
        },
      };
    }),
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MapView({ data, metrica }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const layerReady = useRef(false);
  const { theme } = useTheme();
  const [mode, setMode] = useState<"circles" | "polygons">("polygons");
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const params = new URLSearchParams({ metrica });
    fetch(`${API_URL}/api/geo/municipios?${params}`)
      .then((r) => r.json())
      .then((fc) => {
        const hasPolygons = fc.features?.some(
          (f: GeoJSON.Feature) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
        );
        setGeoData(fc);
        if (!hasPolygons) setMode("circles");
      })
      .catch(() => setMode("circles"));
  }, [metrica]);

  const isCustos = metrica === "custos";
  const fmt = useCallback((v: number) => isCustos ? formatCurrency(v) : formatNumber(v), [isCustos]);

  const setupPopup = useCallback((map: maplibregl.Map, layerId: string) => {
    map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });
    map.on("mousemove", layerId, (e) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties!;
      const atend = p.atendimentos
        ? `<br/><span style="opacity:.7">Atendimentos:</span> <b>${formatNumber(p.atendimentos)}</b>`
        : "";
      const isCust = modeRef.current === "circles" ? isCustos : isCustos;
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">
            <b style="font-size:13px">${p.municipio}</b>
            <span style="opacity:.6;margin-left:4px">${p.uf}</span><br/>
            <span style="opacity:.7">${isCust ? "Custo" : "Óbitos"}:</span> <b>${fmt(p.valor)}</b>${atend}
          </div>`
        )
        .addTo(map);
    });
  }, [isCustos, fmt]);

  const addLayers = useCallback((map: maplibregl.Map) => {
    ["pontos-circle", "poly-fill", "poly-outline"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ["pontos", "polygons"].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });

    if (modeRef.current === "polygons" && geoData) {
      const vals = geoData.features.map((f) => f.properties?.valor ?? 0);
      const max = Math.max(...vals, 1);

      const enriched: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: geoData.features.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            fillColor: getColor((f.properties?.valor ?? 0) / max),
          },
        })),
      };

      map.addSource("polygons", { type: "geojson", data: enriched });
      map.addLayer({
        id: "poly-fill",
        type: "fill",
        source: "polygons",
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-opacity": 0.6,
        },
      });
      map.addLayer({
        id: "poly-outline",
        type: "line",
        source: "polygons",
        paint: {
          "line-color": ["get", "fillColor"],
          "line-width": 0.5,
          "line-opacity": 0.8,
        },
      });
      setupPopup(map, "poly-fill");
    } else {
      const geojson = buildCircleGeoJSON(data);
      map.addSource("pontos", { type: "geojson", data: geojson });
      map.addLayer({
        id: "pontos-circle",
        type: "circle",
        source: "pontos",
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.65,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.9,
        },
      });
      setupPopup(map, "pontos-circle");
    }
    layerReady.current = true;
  }, [data, geoData, setupPopup]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initStyle(theme === "dark"),
      center: [-49.5, -14.5],
      zoom: 3.8,
      pitchWithRotate: true,
      dragRotate: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "280px" });
    map.on("load", () => addLayers(map));
    mapRef.current = map;
    return () => { popupRef.current?.remove(); map.remove(); mapRef.current = null; layerReady.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("carto") as maplibregl.RasterTileSource | undefined)?.setTiles(tileUrl(theme === "dark"));
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addLayers(map);
  }, [mode, geoData, data, metrica, addLayers]);

  const hasPolygons = geoData?.features?.some(
    (f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hasPolygons && (
        <div className="absolute top-3 left-3 z-10 flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <button
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
    </div>
  );
}
