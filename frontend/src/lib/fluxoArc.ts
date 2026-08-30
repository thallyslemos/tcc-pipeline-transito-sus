/** Geometria de arcos e centroides para o mapa de fluxos residência↔ocorrência. */

type LngLat = [number, number];

function ringCentroid(ring: number[][]): LngLat | null {
  if (ring.length < 3) return null;
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    const sumX = ring.reduce((s, c) => s + c[0], 0);
    const sumY = ring.reduce((s, c) => s + c[1], 0);
    return [sumX / ring.length, sumY / ring.length];
  }
  const factor = 1 / (3 * area2);
  return [cx * factor, cy * factor];
}

export function polygonCentroid(geometry: GeoJSON.Geometry | null | undefined): LngLat | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return ringCentroid(geometry.coordinates[0] as number[][]);
  }
  if (geometry.type === "MultiPolygon") {
    let bestArea = 0;
    let best: LngLat | null = null;
    for (const poly of geometry.coordinates) {
      const ring = poly[0] as number[][];
      if (ring.length < 3) continue;
      let area2 = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        area2 += x0 * y1 - x1 * y0;
      }
      const area = Math.abs(area2 / 2);
      if (area > bestArea) {
        bestArea = area;
        best = ringCentroid(ring);
      }
    }
    return best;
  }
  return null;
}

export function buildArcPoints(
  from: LngLat,
  to: LngLat,
  segments = 32,
  arcIndex = 0,
): LngLat[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return [from, to];

  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;
  const sign = arcIndex % 2 === 0 ? 1 : -1;
  const height = dist * 0.22 * sign;
  const cx = midX + nx * height;
  const cy = midY + ny * height;

  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push([
      mt * mt * from[0] + 2 * mt * t * cx + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * cy + t * t * to[1],
    ]);
  }
  points[0] = from;
  points[points.length - 1] = to;
  return points;
}

/**
 * design/DESIGN_SYSTEM.md §8.1 — posicao e angulo (graus, sentido horario,
 * 0 = "apontando pra cima"/norte) de uma seta de sentido sobre o arco, em
 * t ∈ (0,1). Reusa buildArcPoints (a mesma curva ja usada pro teste da
 * bezier) como aproximacao 2D da curva 3D que o deck.gl desenha de
 * verdade — suficiente pra posicionar um icone, nao pra medir distancia.
 *
 * t=0,82 por padrao (nao 1,0): numa tela de "origens", todos os arcos
 * convergem no mesmo municipio, e setas no ponto final empilhariam umas
 * sobre as outras num borrao — a 82% do caminho elas ainda estao abertas
 * em leque, cada uma legivel.
 */
export function pontoEAnguloNoArco(
  from: LngLat,
  to: LngLat,
  t = 0.82,
): { posicao: LngLat; anguloGraus: number } {
  const segments = 100;
  const pontos = buildArcPoints(from, to, segments, 0);
  const indice = Math.min(segments - 1, Math.max(0, Math.round(t * segments)));
  const atual = pontos[indice];
  const proximo = pontos[Math.min(segments, indice + 1)];
  const dx = proximo[0] - atual[0];
  const dy = proximo[1] - atual[1];
  // atan2(dx, dy): angulo a partir do norte (eixo Y), sentido horario —
  // convencao de rotacao de icone de mapa, nao a convencao matematica
  // padrao (a partir do eixo X, anti-horaria).
  const anguloGraus = (Math.atan2(dx, dy) * 180) / Math.PI;
  return { posicao: atual, anguloGraus };
}

export function buildEndpointFeatures(
  origin: LngLat,
  destinations: LngLat[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: origin },
      properties: { role: "origem" },
    },
  ];
  for (const dest of destinations) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: dest },
      properties: { role: "destino" },
    });
  }
  return { type: "FeatureCollection", features };
}
