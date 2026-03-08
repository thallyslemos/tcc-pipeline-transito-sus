"use client";

import { useEffect, useRef, useCallback } from "react";
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

function buildGeoJSON(data: MapPoint[]): GeoJSON.FeatureCollection {
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
          municipio: d.municipio,
          uf: d.uf,
          valor: d.valor,
          atendimentos: d.atendimentos ?? 0,
          color: getColor(ratio),
          radius: getRadius(ratio),
        },
      };
    }),
  };
}

export default function MapView({ data, metrica }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const layerReady = useRef(false);
  const { theme } = useTheme();

  const ensureLayer = useCallback((map: maplibregl.Map, pts: MapPoint[], met: string) => {
    const geojson = buildGeoJSON(pts);

    if (map.getLayer("pontos-circle")) map.removeLayer("pontos-circle");
    if (map.getSource("pontos")) map.removeSource("pontos");

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

    const isCustos = met === "custos";
    const fmt = (v: number) => isCustos ? formatCurrency(v) : formatNumber(v);

    map.on("mouseenter", "pontos-circle", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "pontos-circle", () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });
    map.on("mousemove", "pontos-circle", (e) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties!;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const atend = p.atendimentos ? `<br/><span style="opacity:.7">Atendimentos:</span> <b>${formatNumber(p.atendimentos)}</b>` : "";
      popupRef.current
        ?.setLngLat(coords)
        .setHTML(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">
            <b style="font-size:13px">${p.municipio}</b>
            <span style="opacity:.6;margin-left:4px">${p.uf}</span><br/>
            <span style="opacity:.7">${isCustos ? "Custo" : "Óbitos"}:</span> <b>${fmt(p.valor)}</b>${atend}
          </div>`
        )
        .addTo(map);
    });
    layerReady.current = true;
  }, []);

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

    map.on("load", () => {
      if (data.length) ensureLayer(map, data, metrica);
    });

    mapRef.current = map;
    return () => { popupRef.current?.remove(); map.remove(); mapRef.current = null; layerReady.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("carto") as maplibregl.RasterTileSource | undefined;
    if (src) {
      src.setTiles(tileUrl(theme === "dark"));
    }
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data.length) return;

    if (!map.isStyleLoaded()) {
      map.once("load", () => ensureLayer(map, data, metrica));
      return;
    }

    const src = map.getSource("pontos") as maplibregl.GeoJSONSource | undefined;
    if (src && layerReady.current) {
      src.setData(buildGeoJSON(data));
    } else {
      ensureLayer(map, data, metrica);
    }
  }, [data, metrica, ensureLayer]);

  return <div ref={containerRef} className="h-full w-full" />;
}
