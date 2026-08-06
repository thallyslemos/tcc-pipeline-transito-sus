"use client";

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/ThemeProvider";
import { buildArcPoints, buildEndpointFeatures, polygonCentroid } from "@/lib/fluxoArc";
import { MAP_NEUTRAL_COLOR, mapChoroplethRgb } from "@/lib/mapGradient";
import type { FluxoGeoFeatureCollection } from "@/lib/api";
import type { SimFluxoEdge } from "@/lib/types";

interface Props {
  geoData: FluxoGeoFeatureCollection;
  arestas: SimFluxoEdge[];
  codigoAlvo: string;
  direcao: "origens" | "destinos";
}

function tileUrl(isDark: boolean): string[] {
  const base = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";
  return ["a", "b", "c", "d"].map((s) => base.replace("{s}", s));
}

function mapStyle(isDark: boolean): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: { type: "raster", tiles: tileUrl(isDark), tileSize: 256, attribution: "&copy; CARTO &copy; OpenStreetMap" },
    },
    layers: [{ id: "carto-tiles", type: "raster", source: "carto" }],
  };
}

function buildArcsGeoJson(
  geoData: FluxoGeoFeatureCollection,
  arestas: SimFluxoEdge[],
  codigoAlvo: string
): { arcs: GeoJSON.FeatureCollection; endpoints: GeoJSON.FeatureCollection } {
  const centroidByCode: Record<string, [number, number]> = {};
  for (const feature of geoData.features) {
    const cod6 = String(feature.properties?.cod_mun_ibge ?? "").slice(0, 6);
    const c = polygonCentroid(feature.geometry);
    if (c) centroidByCode[cod6] = c;
  }

  const alvoCentroid = centroidByCode[codigoAlvo];
  if (!alvoCentroid) {
    return {
      arcs: { type: "FeatureCollection", features: [] },
      endpoints: { type: "FeatureCollection", features: [] },
    };
  }

  const maxObitos = Math.max(...arestas.filter((a) => !a.propria_municipio).map((a) => a.obitos), 1);
  const features: GeoJSON.Feature[] = [];
  const destinations: [number, number][] = [];
  let arcIndex = 0;

  for (const edge of arestas) {
    if (edge.propria_municipio) continue;
    const cod6 = edge.cod_mun_ibge.slice(0, 6);
    const destino = centroidByCode[cod6];
    if (!destino) continue;

    destinations.push(destino);
    const coords = buildArcPoints(alvoCentroid, destino, 32, arcIndex);
    arcIndex += 1;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        obitos: edge.obitos,
        municipio: edge.municipio,
        uf: edge.uf,
        participacao: edge.participacao,
        ratioWidth: edge.obitos / maxObitos,
      },
    });
  }

  return {
    arcs: { type: "FeatureCollection", features },
    endpoints: buildEndpointFeatures(alvoCentroid, destinations),
  };
}

export default function FluxoMapView({ geoData, arestas, codigoAlvo, direcao: _direcao }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const { theme } = useTheme();
  const dark = theme === "dark";

  const addLayers = useCallback(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;

    ["fluxo-endpoints", "fluxo-arcs", "poly-outline", "poly-fill"].forEach((id) => {
      if (instance.getLayer(id)) instance.removeLayer(id);
    });
    ["endpoints", "polygons", "arcs"].forEach((id) => {
      if (instance.getSource(id)) instance.removeSource(id);
    });

    if (!geoData?.features?.length) return;

    const flowFeatures = geoData.features.filter((f) => f.properties?.has_flow);
    const maxObitos = Math.max(...flowFeatures.map((f) => Number(f.properties?.obitos ?? 0)), 1);

    const enriched: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geoData.features.map((feature) => {
        const props = feature.properties ?? {};
        if (!props.has_flow) {
          return {
            ...feature,
            properties: {
              ...props,
              fillColor: MAP_NEUTRAL_COLOR,
              lineColor: dark ? "rgba(100,100,100,0.3)" : "rgba(180,180,180,0.4)",
              lineWidth: 0.5,
            },
          };
        }
        const ratio = Math.max(0, Math.min(1, Number(props.obitos) / maxObitos));
        return {
          ...feature,
          properties: {
            ...props,
            fillColor: mapChoroplethRgb(ratio, dark),
            lineColor: props.is_alvo ? "#f97316" : dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
            lineWidth: props.is_alvo ? 3 : 1,
          },
        };
      }),
    };

    instance.addSource("polygons", { type: "geojson", data: enriched });
    instance.addLayer({
      id: "poly-fill",
      type: "fill",
      source: "polygons",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": ["case", ["==", ["get", "has_flow"], true], 0.82, 0.25],
      },
    });
    instance.addLayer({
      id: "poly-outline",
      type: "line",
      source: "polygons",
      paint: {
        "line-color": ["get", "lineColor"],
        "line-width": ["get", "lineWidth"],
      },
    });

    instance.on("mousemove", "poly-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as Record<string, unknown>;
      const hasFlow = p.has_flow === true || p.has_flow === "true";
      const obitos = hasFlow ? `<b>${Number(p.obitos).toLocaleString("pt-BR")}</b> obitos` : "Sem fluxo registrado";
      const part = hasFlow && Number(p.obitos) > 0 ? ` (${(Number(p.participacao) * 100).toFixed(1)}%)` : "";
      const proprio = p.propria_municipio === true || p.propria_municipio === "true" ? "<br/><span style='opacity:.7'>Proprio municipio</span>" : "";
      const alvo = p.is_alvo === true || p.is_alvo === "true" ? "<br/><span style='color:#f97316;font-weight:600'>Municipio alvo</span>" : "";
      popup.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">` +
            `<b style="font-size:13px">${p.municipio ?? "Municipio"}</b> <span style="opacity:.6">${p.uf ?? ""}</span>` +
            `<br/>${obitos}${part}${proprio}${alvo}</div>`
        )
        .addTo(instance);
    });
    instance.on("mouseleave", "poly-fill", () => popup.current?.remove());

    const { arcs, endpoints } = buildArcsGeoJson(geoData, arestas, codigoAlvo);
    if (arcs.features.length) {
      const maxArcObitos = Math.max(...arcs.features.map((f) => Number(f.properties?.obitos ?? 0)), 1);
      instance.addSource("arcs", { type: "geojson", data: arcs });
      instance.addLayer({
        id: "fluxo-arcs",
        type: "line",
        source: "arcs",
        paint: {
          "line-color": dark ? "#fb923c" : "#ea580c",
          "line-width": ["interpolate", ["linear"], ["get", "obitos"], 1, 1.5, maxArcObitos, 8],
          "line-opacity": 0.85,
          "line-cap": "round",
        },
      });
      instance.on("mousemove", "fluxo-arcs", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, unknown>;
        popup.current
          ?.setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">` +
              `<b>${p.municipio ?? ""}</b> <span style="opacity:.6">${p.uf ?? ""}</span>` +
              `<br/><b>${Number(p.obitos).toLocaleString("pt-BR")}</b> obitos` +
              ` (${(Number(p.participacao) * 100).toFixed(1)}%)</div>`
          )
          .addTo(instance);
      });
      instance.on("mouseleave", "fluxo-arcs", () => popup.current?.remove());
    }

    if (endpoints.features.length) {
      instance.addSource("endpoints", { type: "geojson", data: endpoints });
      instance.addLayer({
        id: "fluxo-endpoints",
        type: "circle",
        source: "endpoints",
        paint: {
          "circle-radius": ["case", ["==", ["get", "role"], "origem"], 6, 4],
          "circle-color": ["case", ["==", ["get", "role"], "origem"], "#f97316", "#ea580c"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    const flowCoords = geoData.features
      .filter((f) => f.properties?.has_flow)
      .flatMap((f) => {
        const g = f.geometry;
        if (!g) return [] as number[][];
        if (g.type === "Polygon") return g.coordinates[0] as number[][];
        if (g.type === "MultiPolygon") return g.coordinates.flatMap((p) => p[0] as number[][]);
        return [] as number[][];
      });
    if (flowCoords.length) {
      const lons = flowCoords.map((c) => c[0]);
      const lats = flowCoords.map((c) => c[1]);
      instance.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 60, animate: true, maxZoom: 10 }
      );
    }
  }, [geoData, arestas, codigoAlvo, dark]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: mapStyle(dark),
      center: [-49.5, -14.5],
      zoom: 3.8,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "260px" });
    instance.on("load", addLayers);
    map.current = instance;
    return () => {
      popup.current?.remove();
      instance.remove();
      map.current = null;
    };
  }, [addLayers, dark]);

  useEffect(() => {
    addLayers();
  }, [addLayers]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <div
        className="absolute bottom-3 left-3 z-10 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "linear-gradient(90deg, rgb(30,64,175) 0%, rgb(185,28,28) 100%)" }}
          />
          Escala de obitos
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-1.5 w-6 rounded-full" style={{ backgroundColor: "#ea580c" }} />
          Arco origem-destino
        </div>
      </div>
    </div>
  );
}
