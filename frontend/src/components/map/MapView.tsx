"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/components/ThemeProvider";
import type { MapPoint } from "@/lib/types";

interface Props {
  data: MapPoint[];
  metrica: string;
}

const TILES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO &copy; OpenStreetMap",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO &copy; OpenStreetMap",
  },
};

function getColor(ratio: number): string {
  if (ratio > 0.8) return "#991b1b";
  if (ratio > 0.6) return "#dc2626";
  if (ratio > 0.4) return "#f97316";
  if (ratio > 0.2) return "#facc15";
  return "#86efac";
}

function getRadius(ratio: number): number {
  return 8 + ratio * 30;
}

export default function MapView({ data, metrica }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-15.8, -47.9],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });
    const t = TILES[theme];
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 18 }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const t = TILES[theme];
    tileRef.current.setUrl(t.url);
  }, [theme]);

  useEffect(() => {
    if (!layerRef.current || !data.length) return;
    layerRef.current.clearLayers();

    const max = Math.max(...data.map((d) => d.valor));
    const fmt = metrica === "custos"
      ? (v: number) => `R$ ${(v / 1_000_000).toFixed(2)}M`
      : (v: number) => String(v);

    data.forEach((point) => {
      if (!point.lat || !point.lon) return;
      const ratio = point.valor / max;
      const circle = L.circleMarker([point.lat, point.lon], {
        radius: getRadius(ratio),
        color: getColor(ratio),
        fillColor: getColor(ratio),
        fillOpacity: 0.6,
        weight: 2,
      });
      circle.bindTooltip(
        `<div style="font-family:system-ui;font-size:12px;line-height:1.5">
          <strong>${point.municipio}</strong> (${point.uf})<br/>
          ${metrica === "custos" ? "Custo" : "Óbitos"}: <strong>${fmt(point.valor)}</strong>
          ${point.atendimentos ? `<br/>Atendimentos: ${point.atendimentos}` : ""}
        </div>`,
        { direction: "top", offset: [0, -8] }
      );
      circle.addTo(layerRef.current!);
    });
  }, [data, metrica]);

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}
