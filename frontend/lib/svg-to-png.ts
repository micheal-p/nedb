// ── lib/svg-to-png.ts ───────────────────────────────────────────────────────
// Client-only. Rasterizes a rendered recharts SVG (inside a container element)
// into a PNG data URL, so the chart can be embedded into an Excel workbook or a
// print artefact. Recharts draws with inline attributes/styles, so plain
// serialization reproduces faithfully; we add a white backing so the PNG isn't
// transparent on a spreadsheet grid.

export async function chartToPng(container: HTMLElement | null, scale = 2): Promise<string | null> {
  if (!container) return null;
  const svg = container.querySelector("svg");
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  // Clone and stamp explicit dimensions + namespace for standalone rendering
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
