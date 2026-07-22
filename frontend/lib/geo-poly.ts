// ── lib/geo-poly.ts ─────────────────────────────────────────────────────────
// Small polygon-geometry helpers shared by the map components (LgaMap,
// PenaDrillMap). Client-safe, no dependencies.

export type Geom = { type: string; coordinates: unknown };

export function outerRings(geom: Geom): number[][][] {
  if (geom.type === "Polygon") return [(geom.coordinates as number[][][])[0]];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).map((p) => p[0]);
  return [];
}

export function pointInRing([x, y]: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInGeom(pt: number[], geom: Geom): boolean {
  return outerRings(geom).some((ring) => pointInRing(pt, ring));
}

// A point guaranteed to lie INSIDE the polygon. The naive vertex-average can
// fall outside concave/riverine shapes; when it does, fall back to the
// midpoint of the widest interior span on the ring's vertical middle.
export function interiorPoint(geom: Geom): number[] {
  const rings = outerRings(geom);
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] ?? []);
  if (!ring.length) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const centroid = [sx / ring.length, sy / ring.length];
  if (pointInRing(centroid, ring)) return centroid;

  const ys = ring.map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  let best: number[] | null = null, bestW = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1] - xs[i];
    if (w > bestW) { bestW = w; best = [(xs[i] + xs[i + 1]) / 2, y]; }
  }
  return best ?? centroid;
}

export function geomBounds(geom: Geom): [[number, number], [number, number]] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of outerRings(geom)) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  // GeoJSON is [lng, lat]; Leaflet bounds are [[lat, lng], [lat, lng]]
  return [[minY, minX], [maxY, maxX]];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}
