export const circularChartColors = [
  "var(--primary)",
  "#2563EB",
  "#38BDF8",
  "#0EA5E9",
  "#0284C7",
  "#0369A1",
];

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function scaleHex(hexColor: string, factor: number): string {
  const clean = hexColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return hexColor;
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const rr = clamp(Math.round(r * factor));
  const gg = clamp(Math.round(g * factor));
  const bb = clamp(Math.round(b * factor));
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

export function buildCircularChartColors(baseColor: string): string[] {
  if (!baseColor.startsWith("#")) {
    return circularChartColors;
  }
  return [1.0, 0.88, 0.76, 1.12, 0.66, 0.54].map((f) => scaleHex(baseColor, f));
}
