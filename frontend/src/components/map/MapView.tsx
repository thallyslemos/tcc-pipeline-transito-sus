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
import { textoQualidade } from "@/content/qualidade";

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

/**
 * Auditoria A6: o endpoint raster antigo (basemaps.cartocdn.com/light_all/
 * .../{z}/{x}/{y}@2x.png) parou de servir tile de verdade sem chave de API —
 * toda resposta e um PNG 200 OK com "API KEY REQUIRED" escrito por cima
 * (nao e erro de rede, nao aparece no console). O estilo GL vetorial oficial
 * (Positron/Dark Matter) continua gratuito e sem chave nem marca d'agua —
 * MapLibre aceita a url do style.json direto em `style`.
 */
function style(isDark: boolean): string {
  return isDark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
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

  // Auditoria S4: o mapa abria sempre mostrando a America do Sul inteira pra
  // exibir uma UF. So reenquadra quando o RECORTE muda (geoData/data), nunca
  // ao trocar so a escala de cor — senao o mapa pula a cada clique em
  // "Taxa/100 mil" vs "Obitos absolutos". Soma manual em vez de
  // Math.min(...coords) porque um estado inteiro pode ter dezenas de
  // milhares de vertices de poligono — spread de array grande demais
  // estoura a pilha de argumentos da funcao.
  const fitToRecorte = useCallback(() => {
    const instance = map.current;
    if (!instance) return;
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    const somaCoord = (lon: number, lat: number) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };
    if (mode === "polygons" && geoData) {
      for (const feature of geoData.features) {
        const g = feature.geometry;
        if (!g) continue;
        if (g.type === "Polygon") for (const ring of g.coordinates) for (const [lon, lat] of ring as number[][]) somaCoord(lon, lat);
        else if (g.type === "MultiPolygon") for (const polygon of g.coordinates) for (const ring of polygon) for (const [lon, lat] of ring as number[][]) somaCoord(lon, lat);
      }
    } else {
      for (const point of data) if (point.lat != null && point.lon != null) somaCoord(point.lon, point.lat);
    }
    if (!Number.isFinite(minLon)) return;
    const bounds: [[number, number], [number, number]] = [[minLon, minLat], [maxLon, maxLat]];
    instance.fitBounds(bounds, { padding: 40, maxZoom: 8, animate: !!instance.isStyleLoaded() });
  }, [data, geoData, mode]);

  // Ref sempre atualizada (mesmo motivo de addLayersRef) — chamada tanto no
  // "load"/"idle" inicial do mapa quanto no efeito abaixo, que cobre troca
  // de recorte depois que o mapa ja existe.
  const fitToRecorteRef = useRef(fitToRecorte);
  useEffect(() => { fitToRecorteRef.current = fitToRecorte; }, [fitToRecorte]);

  useEffect(() => {
    if (!map.current) return;
    fitToRecorte();
  }, [fitToRecorte]);

  const popupHtml = useCallback((properties: Record<string, unknown>) => {
    const hasData = properties.has_data !== false;
    const population = properties.populacao != null ? `<br/><span style="opacity:.7">Populacao:</span> <b>${formatNumber(Number(properties.populacao))}</b>` : "";
    const popEstimada = properties.populacao_origem === "estimada";
    const popBadge = popEstimada
      ? ` <span title="${textoQualidade({
          motivo: "populacao_estimada",
          anoReferencia: Number(properties.populacao_ano_referencia ?? 0) || "?",
          defasagemAnos: properties.populacao_defasagem_anos == null ? null : Number(properties.populacao_defasagem_anos),
        })}" style="color:var(--attention);cursor:help">&#9888;</span>`
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

  // addLayersRef sempre aponta pra versao mais recente de addLayers, sem
  // colocar addLayers na lista de dependencias do efeito de CRIACAO do mapa
  // abaixo. Bug real corrigido aqui (auditoria B1): addLayers muda de
  // identidade a cada troca de escala/filtro/tema (ve dependencias do
  // useCallback acima); tendo addLayers como dependencia do efeito que cria
  // `new maplibregl.Map(...)`, QUALQUER uma dessas trocas desmontava
  // (`instance.remove()`) e recriava o mapa inteiro do zero — o basemap
  // sumia e so voltava quando o novo evento "load" disparasse, segundos
  // depois. O mapa agora e criado uma unica vez; troca de tema so troca o
  // estilo do basemap via setStyle, sem destruir a instancia.
  const addLayersRef = useRef(addLayers);
  useEffect(() => { addLayersRef.current = addLayers; }, [addLayers]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: style(dark), center: [-49.5, -14.5], zoom: 3.8 });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "280px" });
    instance.on("load", () => { addLayersRef.current(); fitToRecorteRef.current(); });
    map.current = instance;
    return () => { popup.current?.remove(); instance.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const temaMontado = useRef(false);
  useEffect(() => {
    if (!temaMontado.current) { temaMontado.current = true; return; }
    const instance = map.current;
    if (!instance) return;
    instance.once("idle", () => addLayersRef.current());
    instance.setStyle(style(dark));
  }, [dark]);

  useEffect(() => { addLayers(); }, [addLayers]);
  const hasPolygons = geoData?.features?.some((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type ?? ""));
  return <div className="relative h-full w-full"><div ref={container} className="h-full w-full" />{hasPolygons && <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}><button type="button" onClick={() => setMode("polygons")} className="px-3 py-1.5 text-xs" style={{ backgroundColor: mode === "polygons" ? "var(--brand)" : "var(--surface)", color: mode === "polygons" ? "var(--canvas)" : "var(--ink-2)" }}>Poligonos</button><button type="button" onClick={() => setMode("circles")} className="px-3 py-1.5 text-xs" style={{ backgroundColor: mode === "circles" ? "var(--brand)" : "var(--surface)", color: mode === "circles" ? "var(--canvas)" : "var(--ink-2)" }}>Circulos</button></div>}<div className="absolute bottom-3 left-3 z-10">{escala === "relative" ? <ClassLegend isDark={dark} /> : <MapLegend escala={escala} minV={visual.min} maxV={visual.max} relativeCount={visual.count} />}</div></div>;
}
