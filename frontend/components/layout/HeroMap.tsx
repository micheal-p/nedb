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
  const paths = features.map((f) => ({ name: f.properties.shapeName, d: featurePath(f), c: centroid(f) }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Map of Nigeria's thirty-six states and the Federal Capital Territory"
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
    >
      <defs>
        {/* The country as a field of dots, Cloudflare-style: a hex-offset dot
            pattern used as the LAND FILL, so the shape emerges from dot
            density alone — no outlines, no borders, tiny markup. */}
        <pattern id="hm-dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2.2" cy="2.2" r="1.35" fill="rgba(126,214,164,0.55)" />
          <circle cx="6.7" cy="6.7" r="1.35" fill="rgba(126,214,164,0.38)" />
        </pattern>
        <filter id="hm-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="hm-glow-tight" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* Depth wash under the dots: brighter toward the north-west light */}
        <radialGradient id="hm-fill" cx="38%" cy="28%" r="90%">
          <stop offset="0%" stopColor="rgba(111,207,151,0.14)" />
          <stop offset="50%" stopColor="rgba(111,207,151,0.06)" />
          <stop offset="100%" stopColor="rgba(111,207,151,0.015)" />
        </radialGradient>
        <radialGradient id="hm-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(111,207,151,0.55)" />
          <stop offset="100%" stopColor="rgba(111,207,151,0)" />
        </radialGradient>
      </defs>

      {/* 1 · Soft light under the silhouette so the dot-field reads lit */}
      <g filter="url(#hm-glow)" opacity={0.4} aria-hidden="true">
        {paths.map((p) => (
          <path key={`g-${p.name}`} d={p.d} fill="rgba(52,168,95,0.30)" />
        ))}
      </g>

      {/* 2 · The land: a depth wash, then the dot matrix on top of it */}
      <g aria-hidden="true">
        {paths.map((p) => (
          <path key={`w-${p.name}`} d={p.d} fill="url(#hm-fill)" />
        ))}
      </g>
      <g>
        {paths.map((p) => (
          <path key={p.name} d={p.d} fill="url(#hm-dots)">
            <title>{p.name}</title>
          </path>
        ))}
      </g>

      {/* 3 · The living points: one brighter light per state, twinkling on
             long offset cycles over the dot field */}
      <g aria-hidden="true" filter="url(#hm-glow-tight)">
        {paths.map((p, i) => (
          <circle key={`d-${p.name}`} cx={p.c[0]} cy={p.c[1]} r={3}
            fill="#6FCF97" opacity={0.35 + (i % 4) * 0.08} />
        ))}
      </g>
      <g aria-hidden="true">
        {paths.map((p, i) => (
          <circle key={`c-${p.name}`} cx={p.c[0]} cy={p.c[1]} r={1.5} fill="#D8F4E4"
            className="hm-twinkle" style={{ animationDelay: `${((i * 0.73) % 5.5).toFixed(2)}s` }} />
        ))}
      </g>

      {/* 4 · Abuja: the one bright light, breathing slowly, with a
             cartographic leader line to its label */}
      {fct && (
        <g>
          <circle className="hm-pulse" cx={ax} cy={ay} r={26} fill="url(#hm-halo)" />
          <circle cx={ax} cy={ay} r={8} fill="rgba(111,207,151,0.35)" filter="url(#hm-glow-tight)" />
          <circle cx={ax} cy={ay} r={3.6} fill="#8FE0B0" />
          <line x1={ax + 6} y1={ay - 6} x2={ax + 30} y2={ay - 26} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          <line x1={ax + 30} y1={ay - 26} x2={ax + 46} y2={ay - 26} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          <text x={ax + 52} y={ay - 21} fill="rgba(255,255,255,0.72)" fontSize={15.5} fontFamily="var(--font-sans)" letterSpacing={2.5} fontWeight={600}>
            ABUJA · ECN
          </text>
        </g>
      )}
    </svg>
  );
}
