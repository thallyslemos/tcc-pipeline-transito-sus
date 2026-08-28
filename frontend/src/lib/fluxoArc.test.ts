import { describe, expect, it } from "vitest";

import { buildArcPoints, polygonCentroid } from "./fluxoArc";

describe("fluxoArc", () => {
  it("buildArcPoints ancora exatamente origem e destino", () => {
    const from: [number, number] = [-40.8, -9.5];
    const to: [number, number] = [-38.5, -12.9];
    const arc = buildArcPoints(from, to);
    expect(arc[0][0]).toBeCloseTo(from[0], 10);
    expect(arc[0][1]).toBeCloseTo(from[1], 10);
    expect(arc[arc.length - 1][0]).toBeCloseTo(to[0], 10);
    expect(arc[arc.length - 1][1]).toBeCloseTo(to[1], 10);
  });

  it("polygonCentroid de quadrado conhecido retorna o centro", () => {
    const geometry: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    };
    const c = polygonCentroid(geometry);
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(1, 5);
    expect(c![1]).toBeCloseTo(1, 5);
  });

  it("arcos alternados nao colapsam no segmento reto", () => {
    const from: [number, number] = [-41, -10];
    const to: [number, number] = [-40, -10];
    const arc0 = buildArcPoints(from, to, 16, 0);
    const arc1 = buildArcPoints(from, to, 16, 1);
    const mid0 = arc0[8];
    const mid1 = arc1[8];
    expect(mid0[1]).not.toBeCloseTo(mid1[1], 2);
  });
});
