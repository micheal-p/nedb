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

/** A curved thread from a state's light to Abuja: a quadratic arc bowed
    perpendicular to the straight line, so the mesh reads as threads, not
    spokes. Drawn state → capital, so animated dashes flow INTO the centre. */
function thread(from: [number, number], to: [number, number]): string {
  const [x1, y1] = from, [x2, y2] = to;
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = Math.min(34, dist * 0.16);
  const mx = (x1 + x2) / 2 - (dy / dist) * bow;
  const my = (y1 + y2) / 2 + (dx / dist) * bow;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
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
        {/* The light behind the country: a wide green blur under the
            silhouette, so the map reads as lit from within, not painted on. */}
        <filter id="hm-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="hm-glow-tight" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* Land wash: brighter toward the north-west light, never flat */}
        <radialGradient id="hm-fill" cx="38%" cy="28%" r="90%">
          <stop offset="0%" stopColor="rgba(111,207,151,0.20)" />
          <stop offset="45%" stopColor="rgba(111,207,151,0.10)" />
          <stop offset="100%" stopColor="rgba(111,207,151,0.03)" />
        </radialGradient>
        <radialGradient id="hm-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(111,207,151,0.55)" />
          <stop offset="100%" stopColor="rgba(111,207,151,0)" />
        </radialGradient>
      </defs>

      {/* 1 · The glow underlay: the whole silhouette, blurred green */}
      <g filter="url(#hm-glow)" opacity={0.5} aria-hidden="true">
        {paths.map((p) => (
          <path key={`g-${p.name}`} d={p.d} fill="rgba(52,168,95,0.35)" stroke="#34A85F" strokeWidth={3} />
        ))}
      </g>

      {/* 2 · The states: gradient land, luminous hairline borders */}
      <g>
        {paths.map((p) => (
          <path
            key={p.name}
            d={p.d}
            fill="url(#hm-fill)"
            stroke="rgba(190,232,206,0.55)"
            strokeWidth={0.9}
            strokeLinejoin="round"
          >
            <title>{p.name}</title>
          </path>
        ))}
      </g>

      {/* 3 · The threads: every state's light is sewn to Abuja, and beads of
             light travel the threads into the centre — the reporting flows
             the mandate describes, drawn. Motion dies with
             prefers-reduced-motion (globals.css). */}
      {fct && (
        <g aria-hidden="true" fill="none" strokeLinecap="round">
          {paths.filter((p) => !/Capital/i.test(p.name)).map((p, i) => {
            const d = thread(p.c, [ax, ay]);
            return (
              <g key={`t-${p.name}`}>
                <path d={d} stroke="rgba(111,207,151,0.13)" strokeWidth={0.7} />
                <path d={d} className="hm-thread-flow" stroke="rgba(160,225,187,0.55)" strokeWidth={1.1}
                  style={{ animationDelay: `${(i % 9) * -0.42}s` }} />
              </g>
            );
          })}
        </g>
      )}

      {/* 4 · Measurement points: one quiet light per state — the coverage the
             stat band claims, drawn */}
      <g aria-hidden="true" filter="url(#hm-glow-tight)">
        {paths.map((p, i) => (
          <circle key={`d-${p.name}`} cx={p.c[0]} cy={p.c[1]} r={2.4}
            fill="#6FCF97" opacity={0.28 + (i % 4) * 0.09} />
        ))}
      </g>
      <g aria-hidden="true">
        {paths.map((p) => (
          <circle key={`c-${p.name}`} cx={p.c[0]} cy={p.c[1]} r={1.1} fill="#CDEFDA" opacity={0.8} />
        ))}
      </g>

      {/* 5 · Abuja: the one bright light, breathing slowly (stilled entirely
             under prefers-reduced-motion, see globals.css) */}
      {fct && (
        <g>
          <circle className="hm-pulse" cx={ax} cy={ay} r={26} fill="url(#hm-halo)" />
          <circle cx={ax} cy={ay} r={8} fill="rgba(111,207,151,0.35)" filter="url(#hm-glow-tight)" />
          <circle cx={ax} cy={ay} r={3.6} fill="#8FE0B0" />
          <text x={ax + 20} y={ay + 5} fill="rgba(255,255,255,0.62)" fontSize={17} fontFamily="var(--font-sans)" letterSpacing={2} fontWeight={600}>
            ABUJA · ECN
          </text>
        </g>
      )}
    </svg>
  );
}
