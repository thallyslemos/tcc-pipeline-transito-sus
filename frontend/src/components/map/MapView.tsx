"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchSimGeo } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import { formatNumber, formatTaxa100k, formatTaxa10k } from "@/lib/format";
import { MAP_NEUTRAL_COLOR, mapChoroplethClasse, mapChoroplethRgb } from "@/lib/mapGradient";
import type { MapPoint } from "@/lib/types";
import MapLegend, { type MapScaleMode } from "@/components/map/MapLegend";
import ClassLegend from "@/components/ui/ClassLegend";

/**
 * design/DESIGN_SYSTEM.md §8: cor de "relative" (taxa/100mil) vem de classes
 * FIXAS, nao do min/max do recorte — o mesmo municipio nao pode mudar de cor
 * so porque o filtro mudou. "total" e "vehicle_rate" nao tem quintis
 * validados ainda; continuam na escala relativa antiga (limitacao
 * documentada, nao descuido).
 */
function corPorValor(escala: MapScaleMode, value: number, ratio: number, dark: boolean): string {
  return escala === "relative" ? mapChoroplethClasse(value, dark) : mapChoroplethRgb(ratio, dark);
}

interface Props {
  data: MapPoint[];
  metrica: string;
  dimensao?: "ocorrencia" | "residencia";
  ano?: number;
  uf?: string;
  regiao?: string;
  tipo_veiculo?: string;
  escala: MapScaleMode;
}

function tileUrl(isDark: boolean): string[] {
  const base = isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";
  return ["a", "b", "c", "d"].map((subdomain) => base.replace("{s}", subdomain));
}

function style(isDark: boolean): maplibregl.StyleSpecification {
  return { version: 8, sources: { carto: { type: "raster", tiles: tileUrl(isDark), tileSize: 256, attribution: "&copy; CARTO &copy; OpenStreetMap" } }, layers: [{ id: "carto-tiles", type: "raster", source: "carto" }] };
}

function valueOf(point: MapPoint | Record<string, unknown>, escala: MapScaleMode): number | null {
  const record = point as Record<string, unknown>;
  if (record.has_data === false) return null;
  if (escala === "total") {
    const value = record.valor;
    return typeof value === "number" ? value : null;
  }
  const field = escala === "vehicle_rate" ? "taxa_obitos_10mil_veiculos" : "taxa_obitos_100mil";
  const rate = record[field];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

function circles(data: MapPoint[], escala: MapScaleMode, dark: boolean, min: number, max: number): GeoJSON.FeatureCollection {
  const span = max - min || 1;
  return {
    type: "FeatureCollection",
    features: data.filter((point) => point.lat != null && point.lon != null).map((point) => {
      const value = valueOf(point, escala);
      const valid = value != null && (escala === "total" ? value >= 0 : value > 0);
      const ratio = valid ? Math.max(0, Math.min(1, (value! - min) / span)) : 0;
      const color = valid ? corPorValor(escala, value!, ratio, dark) : MAP_NEUTRAL_COLOR;
      return { type: "Feature", geometry: { type: "Point", coordinates: [point.lon!, point.lat!] }, properties: { ...point, color, radius: 7 + ratio * 25 } };
    }),
  };
}

export default function MapView({ data, metrica: _metrica, dimensao, ano, uf, regiao, tipo_veiculo, escala }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [mode, setMode] = useState<"polygons" | "circles">("polygons");
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const visual = useMemo(() => {
    const values = (mode === "polygons" && geoData?.features?.length ? geoData.features.map((feature) => valueOf((feature.properties ?? {}) as Record<string, unknown>, escala)) : data.map((point) => valueOf(point, escala))).filter((value): value is number => value != null && (escala === "total" || value > 0));
    if (!values.length) return { min: 0, max: 1, count: 0 };
    return { min: Math.min(...values), max: Math.max(...values) || 1, count: values.length };
  }, [data, escala, geoData, mode]);

  useEffect(() => {
    fetchSimGeo({ dimensao, ano, uf, regiao, tipo_veiculo })
      .then((featureCollection) => {
        setGeoData(featureCollection);
        if (!featureCollection.features?.some((feature: GeoJSON.Feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type ?? ""))) setMode("circles");
      })
      .catch(() => setGeoData(null));
  }, [ano, dimensao, regiao, tipo_veiculo, uf]);

  const popupHtml = useCallback((properties: Record<string, unknown>) => {
    const hasData = properties.has_data !== false;
    const population = properties.populacao != null ? `<br/><span style="opacity:.7">Populacao:</span> <b>${formatNumber(Number(properties.populacao))}</b>` : "";
    const popEstimada = properties.populacao_origem === "estimada";
    const popBadge = popEstimada
      ? ` <span title="Populacao estimada: ano ${properties.populacao_ano_referencia ?? "?"} (defasagem de ${properties.populacao_defasagem_anos ?? "?"} ${properties.populacao_defasagem_anos === 1 ? "ano" : "anos"})" style="color:var(--warning);cursor:help">&#9888;</span>`
      : "";
    const rate = properties.taxa_obitos_100mil != null ? `<br/><span style="opacity:.7">Taxa:</span> <b>${formatTaxa100k(Number(properties.taxa_obitos_100mil))}</b> / 100 mil hab.${popBadge}` : "";
    const vehicleRate = properties.taxa_obitos_10mil_veiculos != null
      ? `<br/><span style="opacity:.7">Taxa veicular:</span> <b>${formatTaxa10k(Number(properties.taxa_obitos_10mil_veiculos))}</b> / 10 mil veiculos`
      : properties.frota_status === "indisponivel"
        ? `<br/><span style="opacity:.7">Taxa veicular:</span> <b>N/D</b> (frota SENATRAN indisponivel)`
        : "";
    const deaths = hasData ? formatNumber(Number(properties.valor ?? 0)) : "Sem registro";
    return `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6"><b style="font-size:13px">${properties.municipio ?? "Municipio"}</b> <span style="opacity:.6">${properties.uf ?? ""}</span><br/><span style="opacity:.7">Obitos:</span> <b>${deaths}</b>${population}${rate}${vehicleRate}</div>`;
  }, []);

  const addLayers = useCallback(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;
    ["poly-fill", "poly-outline", "points-circle"].forEach((id) => { if (instance.getLayer(id)) instance.removeLayer(id); });
    ["polygons", "points"].forEach((id) => { if (instance.getSource(id)) instance.removeSource(id); });
    const span = visual.max - visual.min || 1;
    if (mode === "polygons" && geoData) {
      const enriched = { ...geoData, features: geoData.features.map((feature) => { const props = (feature.properties ?? {}) as Record<string, unknown>; const value = valueOf(props, escala); const valid = value != null && (escala === "total" ? value >= 0 : value > 0); const ratio = valid ? Math.max(0, Math.min(1, (value! - visual.min) / span)) : 0; return { ...feature, properties: { ...props, fillColor: valid ? corPorValor(escala, value!, ratio, dark) : MAP_NEUTRAL_COLOR } }; }) };
      instance.addSource("polygons", { type: "geojson", data: enriched });
      instance.addLayer({ id: "poly-fill", type: "fill", source: "polygons", paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 0.9 } });
      instance.on("mousemove", "poly-fill", (event) => { const feature = event.features?.[0]; if (!feature) return; popup.current?.setLngLat(event.lngLat).setHTML(popupHtml(feature.properties as Record<string, unknown>)).addTo(instance); });
    } else {
      instance.addSource("points", { type: "geojson", data: circles(data, escala, dark, visual.min, visual.max) });
      instance.addLayer({ id: "points-circle", type: "circle", source: "points", paint: { "circle-radius": ["get", "radius"], "circle-color": ["get", "color"], "circle-opacity": 0.58, "circle-stroke-width": 1, "circle-stroke-color": ["get", "color"] } });
      instance.on("mousemove", "points-circle", (event) => { const feature = event.features?.[0]; if (!feature) return; popup.current?.setLngLat(event.lngLat).setHTML(popupHtml(feature.properties as Record<string, unknown>)).addTo(instance); });
    }
  }, [data, dark, escala, geoData, mode, popupHtml, visual]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: style(dark), center: [-49.5, -14.5], zoom: 3.8 });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "280px" });
    instance.on("load", addLayers);
    map.current = instance;
    return () => { popup.current?.remove(); instance.remove(); map.current = null; };
  }, [addLayers, dark]);

  useEffect(() => { addLayers(); }, [addLayers]);
  const hasPolygons = geoData?.features?.some((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type ?? ""));
  return <div className="relative h-full w-full"><div ref={container} className="h-full w-full" />{hasPolygons && <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}><button type="button" onClick={() => setMode("polygons")} className="px-3 py-1.5 text-xs" style={{ backgroundColor: mode === "polygons" ? "var(--primary)" : "var(--bg-card)", color: mode === "polygons" ? "var(--primary-fg)" : "var(--fg-secondary)" }}>Poligonos</button><button type="button" onClick={() => setMode("circles")} className="px-3 py-1.5 text-xs" style={{ backgroundColor: mode === "circles" ? "var(--primary)" : "var(--bg-card)", color: mode === "circles" ? "var(--primary-fg)" : "var(--fg-secondary)" }}>Circulos</button></div>}<div className="absolute bottom-3 left-3 z-10">{escala === "relative" ? <ClassLegend isDark={dark} /> : <MapLegend escala={escala} minV={visual.min} maxV={visual.max} relativeCount={visual.count} />}</div></div>;
}
