import {
  resolveUsaStateCode,
  USA_MAP_VIEWBOX,
  USA_STATE_BOUNDARIES,
} from "./usaStateBoundaries";

export interface IHeatMapRecord {
  area_key: string;
  area_label?: string;
  metric_value: number;
  secondary_value?: number;
  change_pct?: number;
  target_value?: number;
  risk_score?: number;
  category?: string;
  forecast_value?: number;
  notes?: string;
}

export interface IHeatMapVisualConfig {
  map_scope: string;
  geographic_level: string;
  color_scale: string;
  show_labels: boolean;
  show_legend: boolean;
  aggregation_method?: string;
}

export interface IHeatMapSummaryHighlight {
  area_key: string;
  metric_value?: number;
  change_pct?: number;
}

export interface IHeatMapPayload {
  records: IHeatMapRecord[];
  visualConfig: IHeatMapVisualConfig;
  summary: {
    matched_areas: number;
    unmatched_keys: string[];
    highest: IHeatMapSummaryHighlight | null;
    lowest: IHeatMapSummaryHighlight | null;
    largest_positive_change: IHeatMapSummaryHighlight | null;
    largest_negative_change: IHeatMapSummaryHighlight | null;
    warnings: string[];
  };
}

function heatColor(t: number, scale: string): string {
  const clamped = Math.max(0, Math.min(1, t));
  const stops =
    scale === "diverging"
      ? (
          [
            [0, "#1d4ed8"],
            [0.5, "#e2e8f0"],
            [1, "#dc2626"],
          ] as [number, string][]
        )
      : (
          [
            [0, "#0f172a"],
            [0.2, "#0e7490"],
            [0.45, "#14b8a6"],
            [0.7, "#fbbf24"],
            [1, "#ea580c"],
          ] as [number, string][]
        );

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped <= stops[i + 1][0]) {
      const a = stops[i];
      const b = stops[i + 1];
      const u = (clamped - a[0]) / (b[0] - a[0] || 1);
      return lerpHex(a[1], b[1], u);
    }
  }
  return stops[stops.length - 1][1];
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function ringBounds(ring: number[][]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  cx: number;
  cy: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) > 1e-6) {
    cx /= 6 * area;
    cy /= 6 * area;
  } else {
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
  }
  return { minX, minY, maxX, maxY, area: Math.abs(area), cx, cy };
}

function drawProjectedRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  if (ring.length < 3) {
    return;
  }
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const x = offsetX + ring[i][0] * scale;
    const y = offsetY + ring[i][1] * scale;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

/**
 * Draws a Heat Map Story frame for the builder canvas preview.
 * Uses pre-projected Albers-style USA state paths (no overlapping boxes).
 */
export function drawHeatMapFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: IHeatMapPayload,
): void {
  const cfg = payload.visualConfig;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const pad = 10;
  const scale = Math.min(
    (width - pad * 2) / USA_MAP_VIEWBOX.width,
    (height - pad * 2) / USA_MAP_VIEWBOX.height,
  );
  const offsetX = (width - USA_MAP_VIEWBOX.width * scale) / 2;
  const offsetY = (height - USA_MAP_VIEWBOX.height * scale) / 2;

  const metricByCode = new Map<string, IHeatMapRecord>();
  for (const record of payload.records) {
    const code = resolveUsaStateCode(record.area_key);
    if (code) {
      metricByCode.set(code, record);
    }
  }

  const values = [...metricByCode.values()].map((r) => r.metric_value);
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 1;
  const span = maxV - minV || 1;

  // Soft nation backdrop
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#1e293b";
  for (const state of Object.values(USA_STATE_BOUNDARIES)) {
    for (const ring of state.rings) {
      drawProjectedRing(ctx, ring, scale, offsetX, offsetY);
      ctx.fill();
    }
  }
  ctx.restore();

  const labelCandidates: Array<{
    code: string;
    x: number;
    y: number;
    area: number;
  }> = [];

  for (const [code, state] of Object.entries(USA_STATE_BOUNDARIES)) {
    const record = metricByCode.get(code);
    const t = record == null ? null : (record.metric_value - minV) / span;
    const fill = t == null ? "#1f2937" : heatColor(t, cfg.color_scale);

    let largest = ringBounds(state.rings[0]);
    for (const ring of state.rings) {
      drawProjectedRing(ctx, ring, scale, offsetX, offsetY);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(226,232,240,.45)";
      ctx.lineWidth = Math.max(0.6, 0.9 * scale);
      ctx.stroke();
      const bounds = ringBounds(ring);
      if (bounds.area > largest.area) {
        largest = bounds;
      }
    }

    labelCandidates.push({
      code,
      x: offsetX + largest.cx * scale,
      y: offsetY + largest.cy * scale,
      area: largest.area * scale * scale,
    });
  }

  if (cfg.show_labels) {
    // Only label states with enough painted area to avoid NE clutter.
    const minLabelArea = 180;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.max(8, Math.round(9 * scale * 1.4))}px system-ui,sans-serif`;
    for (const label of labelCandidates) {
      if (label.area < minLabelArea) {
        continue;
      }
      ctx.fillStyle = "rgba(15,23,42,.55)";
      ctx.fillText(label.code, label.x + 0.6, label.y + 0.6);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label.code, label.x, label.y);
    }
  }

  const highestCode = payload.summary.highest
    ? resolveUsaStateCode(payload.summary.highest.area_key)
    : null;
  const lowestCode = payload.summary.lowest
    ? resolveUsaStateCode(payload.summary.lowest.area_key)
    : null;

  if (cfg.show_labels && highestCode) {
    const hit = labelCandidates.find((c) => c.code === highestCode);
    if (hit) {
      drawCallout(ctx, hit.x, hit.y - 12 * scale, "HOT", "#fbbf24", scale);
    }
  }
  if (cfg.show_labels && lowestCode) {
    const hit = labelCandidates.find((c) => c.code === lowestCode);
    if (hit) {
      drawCallout(ctx, hit.x, hit.y + 12 * scale, "COLD", "#38bdf8", scale);
    }
  }

  if (cfg.show_legend !== false) {
    const lx = width - 132;
    const ly = 12;
    const lw = 112;
    const lh = 10;
    const gradient = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    for (let i = 0; i <= 10; i++) {
      gradient.addColorStop(i / 10, heatColor(i / 10, cfg.color_scale));
    }
    ctx.fillStyle = "rgba(15,23,42,.82)";
    ctx.strokeStyle = "rgba(148,163,184,.35)";
    ctx.lineWidth = 1;
    roundRect(ctx, lx - 8, ly - 8, lw + 16, 38, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = gradient;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "9px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(formatMetric(minV), lx, ly + 24);
    ctx.textAlign = "right";
    ctx.fillText(formatMetric(maxV), lx + lw, ly + 24);
  }
}

function drawCallout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  scale: number,
): void {
  const fontSize = Math.max(8, Math.round(9 * scale * 1.3));
  ctx.font = `700 ${fontSize}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 10;
  const h = fontSize + 6;
  ctx.fillStyle = "rgba(15,23,42,.85)";
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatMetric(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
}
