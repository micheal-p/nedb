// ── HeroMap ─────────────────────────────────────────────────────────────────
// The home hero's visual, drawn from the data bank's own boundary reference
// file rather than photographed. A statistics institution's picture of the
// country is the map it publishes on: thirty-six states and the FCT in
// hairline strokes, with one marker on the seat of the Commission. Rendered
// on the server straight into the page — no client JS, no image request.
//
// Points are decimated and rounded before they become path data: the full
// boundary file carries ~10,800 vertices and survey-grade precision, and a
// 360px-wide illustration needs neither.

import statesGeo from "@/public/nigeria-states.json";

type Ring = [number, number][];
type Feature = {
  properties: { shapeName: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
};

const BBOX = { minX: 2.69, maxX: 14.68, minY: 4.27, maxY: 13.89 };
const W = 720;
const H = Math.round((W * (BBOX.maxY - BBOX.minY)) / (BBOX.maxX - BBOX.minX));
const PAD = 8;

const px = (lon: number) => PAD + ((lon - BBOX.minX) / (BBOX.maxX - BBOX.minX)) * (W - 2 * PAD);
const py = (lat: number) => PAD + ((BBOX.maxY - lat) / (BBOX.maxY - BBOX.minY)) * (H - 2 * PAD);

function ringPath(ring: Ring): string {
  // keep every 3rd vertex; always close the ring
  const pts = ring.filter((_, i) => i % 3 === 0);
  if (pts.length < 3) return "";
  return (
    "M" +
    pts.map(([lon, lat]) => `${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join("L") +
    "Z"
  );
}

function featurePath(f: Feature): string {
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
  return polys.map((poly) => poly.map(ringPath).join("")).join("");
}

function centroid(f: Feature): [number, number] {
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
  let sx = 0, sy = 0, n = 0;
  for (const poly of polys) for (const [lon, lat] of poly[0]) { sx += lon; sy += lat; n++; }
  return [px(sx / n), py(sy / n)];
}

export default function HeroMap() {
  const features = (statesGeo as unknown as { features: Feature[] }).features;
  const fct = features.find((f) => /Capital/i.test(f.properties.shapeName));
  const [ax, ay] = fct ? centroid(fct) : [0, 0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Map of Nigeria's thirty-six states and the Federal Capital Territory"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {features.map((f) => (
        <path
          key={f.properties.shapeName}
          d={featurePath(f)}
          fill="rgba(255,255,255,0.035)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={0.8}
          strokeLinejoin="round"
        >
          <title>{f.properties.shapeName}</title>
        </path>
      ))}
      {fct && (
        <g>
          <circle cx={ax} cy={ay} r={10} fill="rgba(111,207,151,0.18)" />
          <circle cx={ax} cy={ay} r={3.5} fill="#6FCF97" />
          <text x={ax + 16} y={ay + 4} fill="rgba(255,255,255,0.55)" fontSize={17} fontFamily="var(--font-sans)" letterSpacing={1.5}>
            ABUJA · ECN
          </text>
        </g>
      )}
    </svg>
  );
}
