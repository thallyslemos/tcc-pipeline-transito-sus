"use client";

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, TextLayer } from "@deck.gl/layers";
import { useTheme } from "@/components/ThemeProvider";
import { buildEndpointFeatures, polygonCentroid, pontoEAnguloNoArco } from "@/lib/fluxoArc";
import { MAP_NEUTRAL_COLOR, mapChoroplethGradientCss, mapChoroplethRgb } from "@/lib/mapGradient";
import { formatPercentual } from "@/lib/format";
import type { FluxoGeoFeatureCollection } from "@/lib/api";
import type { SimFluxoEdge } from "@/lib/types";

type LngLat = [number, number];

interface ArcDatum {
  source: LngLat;
  target: LngLat;
  obitos: number;
  municipio: string;
  uf: string;
  participacao: number;
}

type RgbColor = [number, number, number];

/**
 * design/DESIGN_SYSTEM.md §8.1 — auditoria S1: o design system original nao
 * previa uma cor de DADO propria pro mapa de fluxos, entao o arco usava
 * ambar/laranja generico (sem correspondencia com nenhum token). Valores
 * literais (deck.gl nao le var() do CSS) espelhando --flow-origin/
 * --flow-destino de app/tokens.css — origem em azul de exposicao
 * (residencia), destino em vermelho de risco (= --risk-5, ocorrencia).
 */
const ARC_COLOR_LIGHT: { source: RgbColor; target: RgbColor } = {
  source: [79, 134, 179], // --flow-origin claro
  target: [158, 62, 36], // --flow-destino claro (= --risk-5)
};
const ARC_COLOR_DARK: { source: RgbColor; target: RgbColor } = {
  source: [106, 158, 202], // --flow-origin escuro
  target: [224, 140, 94], // --flow-destino escuro (= --risk-5 escuro)
};

interface Props {
  geoData: FluxoGeoFeatureCollection;
  arestas: SimFluxoEdge[];
  codigoAlvo: string;
  direcao: "origens" | "destinos";
}

/**
 * Auditoria A6 — ver o mesmo comentario em MapView.tsx: o raster antigo do
 * CARTO parou de servir tile de verdade sem chave (PNG 200 OK com "API KEY
 * REQUIRED" escrito por cima). Estilo GL vetorial oficial continua gratuito.
 */
function mapStyle(isDark: boolean): string {
  return isDark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

/**
 * Monta os dados de arco (3D, via deck.gl ArcLayer) e os pontos de extremidade.
 *
 * A direcao do arco (source -> target) segue o sentido real do fluxo: em
 * "origens" o alvo e o municipio de ocorrencia, entao o arco vai da residencia
 * (source) ate o alvo (target); em "destinos" o alvo e a residencia, entao o
 * arco vai do alvo (source) ate o municipio de ocorrencia (target).
 */
function buildFlowData(
  geoData: FluxoGeoFeatureCollection,
  arestas: SimFluxoEdge[],
  codigoAlvo: string,
  direcao: "origens" | "destinos"
): { arcs: ArcDatum[]; endpoints: GeoJSON.FeatureCollection } {
  const centroidByCode: Record<string, LngLat> = {};
  for (const feature of geoData.features) {
    const cod6 = String(feature.properties?.cod_mun_ibge ?? "").slice(0, 6);
    const c = polygonCentroid(feature.geometry);
    if (c) centroidByCode[cod6] = c;
  }

  const alvoCentroid = centroidByCode[codigoAlvo];
  if (!alvoCentroid) {
    return { arcs: [], endpoints: { type: "FeatureCollection", features: [] } };
  }

  const arcs: ArcDatum[] = [];
  const destinations: LngLat[] = [];

  for (const edge of arestas) {
    if (edge.propria_municipio) continue;
    const cod6 = edge.cod_mun_ibge.slice(0, 6);
    const outro = centroidByCode[cod6];
    if (!outro) continue;

    destinations.push(outro);
    const [source, target] = direcao === "origens" ? [outro, alvoCentroid] : [alvoCentroid, outro];
    arcs.push({
      source,
      target,
      obitos: edge.obitos,
      municipio: edge.municipio,
      uf: edge.uf,
      participacao: edge.participacao,
    });
  }

  return { arcs, endpoints: buildEndpointFeatures(alvoCentroid, destinations) };
}

export default function FluxoMapView({ geoData, arestas, codigoAlvo, direcao }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const deckOverlay = useRef<MapboxOverlay | null>(null);
  const { theme } = useTheme();
  const dark = theme === "dark";

  const addLayers = useCallback(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;

    ["fluxo-endpoints", "poly-outline", "poly-fill"].forEach((id) => {
      if (instance.getLayer(id)) instance.removeLayer(id);
    });
    ["endpoints", "polygons"].forEach((id) => {
      if (instance.getSource(id)) instance.removeSource(id);
    });

    if (!geoData?.features?.length) {
      deckOverlay.current?.setProps({ layers: [] });
      return;
    }

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
      const part = hasFlow && Number(p.obitos) > 0 ? ` (${formatPercentual(Number(p.participacao) * 100)}%)` : "";
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

    const { arcs, endpoints } = buildFlowData(geoData, arestas, codigoAlvo, direcao);
    const arcPalette = dark ? ARC_COLOR_DARK : ARC_COLOR_LIGHT;

    // Auditoria S6/design/DESIGN_SYSTEM.md §8.1: cada arco ganha um
    // triangulo em --flow-destino a t=0,82 apontando pro destino. No modo
    // "destinos dos residentes" o sentido do FLUXO inverte (arestas.target
    // vira o municipio alvo, nao mais o "outro"), entao a seta tem que
    // apontar pra fora do alvo, no mesmo t — inverte-se o par usado pra
    // calcular o angulo, sem inverter o arco em si (que ja segue
    // source/target corretos, ver buildFlowData acima).
    const setas = arcs.map((arco) => {
      const [de, para] = direcao === "origens" ? [arco.source, arco.target] : [arco.target, arco.source];
      const { posicao, anguloGraus } = pontoEAnguloNoArco(de, para, 0.82);
      return { posicao, anguloGraus, obitos: arco.obitos };
    });

    deckOverlay.current?.setProps({
      layers: [
        new ArcLayer<ArcDatum>({
          id: "fluxo-arcs-3d",
          data: arcs,
          pickable: true,
          greatCircle: true,
          numSegments: 48,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getSourceColor: [...arcPalette.source, 210],
          getTargetColor: [...arcPalette.target, 230],
          // Largura por raiz do volume (largura linear apaga os fluxos
          // pequenos, que sao justamente os que revelam o alcance da
          // rede). Altura FIXA e rasa: a altura existe so pra desembaracar
          // arcos sobrepostos no plano, nao pra efeito tridimensional — um
          // arco alto rouba a leitura da geografia e sugere que o fluxo
          // "sobe", o que nao significa nada (era 0,5-1,2 antes, escalado
          // por obitos; a auditoria S6 pediu 0,15 fixo).
          getWidth: (d) => Math.sqrt(d.obitos),
          getHeight: 0.15,
          getTilt: 0,
          widthMinPixels: 1.5,
          widthMaxPixels: 12,
          opacity: 0.55,
          parameters: { depthCompare: "always" },
        }),
        new TextLayer<{ posicao: [number, number]; anguloGraus: number; obitos: number }>({
          id: "fluxo-setas",
          data: setas,
          // O atlas de fonte do TextLayer so gera os caracteres do
          // characterSet default (basicamente ASCII) — sem declarar "▲"
          // aqui, o deck.gl loga "Missing character" e nao desenha nada,
          // silenciosamente (bug real, so aparece no console, nao quebra a
          // pagina).
          characterSet: ["▲"],
          getPosition: (d) => d.posicao,
          getText: () => "▲",
          getSize: 13,
          getAngle: (d) => -d.anguloGraus,
          getColor: [...arcPalette.target, 235],
          billboard: true,
          parameters: { depthCompare: "always" },
        }),
      ],
      getTooltip: ({ object }: { object?: ArcDatum }) => {
        if (!object) return null;
        return {
          html:
            `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.6">` +
            `<b>${object.municipio}</b> <span style="opacity:.6">${object.uf}</span>` +
            `<br/><b>${object.obitos.toLocaleString("pt-BR")}</b> obitos` +
            ` (${formatPercentual(object.participacao * 100)}%)</div>`,
          style: {
            backgroundColor: dark ? "#1f2937" : "#ffffff",
            color: dark ? "#f3f4f6" : "#111827",
            border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            padding: "6px 10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          },
        };
      },
    });

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
  }, [geoData, arestas, codigoAlvo, direcao, dark]);

  // Mesmo bug e mesma correcao de MapView.tsx (auditoria B1): addLayers muda
  // de identidade a cada troca de municipio/direcao/tema, e tinha-lo como
  // dependencia do efeito de CRIACAO do mapa desmontava e recriava a
  // instancia inteira a cada interacao — o basemap sumia por alguns
  // segundos. addLayersRef quebra esse acoplamento; o mapa e criado uma
  // unica vez, e troca de tema so troca o estilo via setStyle.
  const addLayersRef = useRef(addLayers);
  useEffect(() => { addLayersRef.current = addLayers; }, [addLayers]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: mapStyle(dark),
      center: [-49.5, -14.5],
      zoom: 3.8,
      pitch: 45,
      bearing: -10,
    });
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    instance.addControl(overlay);
    deckOverlay.current = overlay;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "260px" });
    instance.on("load", () => addLayersRef.current());
    map.current = instance;
    return () => {
      popup.current?.remove();
      instance.remove();
      map.current = null;
      deckOverlay.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const temaMontado = useRef(false);
  useEffect(() => {
    if (!temaMontado.current) { temaMontado.current = true; return; }
    const instance = map.current;
    if (!instance) return;
    instance.once("idle", () => addLayersRef.current());
    instance.setStyle(mapStyle(dark));
  }, [dark]);

  useEffect(() => {
    addLayers();
  }, [addLayers]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <div
        className="absolute bottom-3 left-3 z-10 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-2)" }}
      >
        <div className="flex items-center gap-2">
          {/* Auditoria S1: legenda desatualizada — ainda mostrava o
              gradiente azul->vermelho generico ja substituido pela rampa de
              risco em mapGradient.ts (auditoria B2). */}
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: mapChoroplethGradientCss(dark) }}
          />
          Escala de obitos
        </div>
        <div className="mt-1 flex items-center gap-2">
          {/* Auditoria S1: swatch usava ambar/laranja generico, sem
              correspondencia com as cores reais do arco (--flow-origin/
              --flow-destino). */}
          <span
            className="inline-block h-1.5 w-6 rounded-full"
            style={{
              background: dark
                ? "linear-gradient(90deg, rgb(106,158,202) 0%, rgb(224,140,94) 100%)"
                : "linear-gradient(90deg, rgb(79,134,179) 0%, rgb(158,62,36) 100%)",
            }}
          />
          Arco 3D origem &rarr; destino (arraste com botao direito para inclinar)
        </div>
      </div>
    </div>
  );
}
