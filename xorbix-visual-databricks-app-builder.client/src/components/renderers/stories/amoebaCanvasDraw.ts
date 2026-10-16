import { catColor, healthColor, hashStr } from "./storyColorUtils";

export interface IAmoebaRecord {
  entity_id: string;
  entity_label: string;
  category: string;
  size_value: number;
  x_value: number;
  y_value: number;
  change_value: number;
  health_score?: number;
  risk_score?: number;
}

export interface IAmoebaVisualConfig {
  layout_mode: string;
  size_scale: string;
  min_radius_px: number;
  max_radius_px: number;
  color_by: string;
  pulse_by: string;
  pulse_threshold: number;
  pulse_threshold_mode: string;
  shape_variation: number;
  label_mode: string;
  animation_enabled: boolean;
  animation_speed: number;
}

export interface IAmoebaPayload {
  records: IAmoebaRecord[];
  visualConfig: IAmoebaVisualConfig;
}

interface ILaidOutAmoeba extends IAmoebaRecord {
  _x: number;
  _y: number;
  _r: number;
  _seed: number;
}

function toRgb(c: string): string {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    const full =
      h.length === 3
        ? h
            .split("")
            .map((x) => x + x)
            .join("")
        : h;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  const m = c.match(/(\d+)/g);
  return m ? m.slice(0, 3).join(",") : "45,212,191";
}

function scaleSize(
  v: number,
  minV: number,
  maxV: number,
  cfg: IAmoebaVisualConfig,
): number {
  const lo = cfg.min_radius_px || 42;
  const hi = cfg.max_radius_px || 130;
  if (!(maxV > minV)) {
    return (lo + hi) / 2;
  }
  let t = (v - minV) / (maxV - minV);
  const mode = (cfg.size_scale || "sqrt").toLowerCase();
  if (mode === "log") {
    t = Math.log1p(t * 9) / Math.log(10);
  } else if (mode === "sqrt") {
    t = Math.sqrt(t);
  }
  return lo + t * (hi - lo);
}

function layout(
  nodes: ILaidOutAmoeba[],
  width: number,
  height: number,
  cfg: IAmoebaVisualConfig,
): void {
  const maxR = Math.max(
    ...nodes.map((n) => n._r),
    cfg.min_radius_px || 42,
  );
  const pad = Math.max(28, maxR + 16);
  const mode = (cfg.layout_mode || "hybrid").toLowerCase();
  const cats = [...new Set(nodes.map((n) => n.category || "Other"))];
  const xs = nodes.map((n) => n.x_value);
  const ys = nodes.map((n) => n.y_value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const nx = (x: number) =>
    pad + ((x - minX) / (maxX - minX || 1)) * (width - 2 * pad);
  const ny = (y: number) =>
    height - pad - ((y - minY) / (maxY - minY || 1)) * (height - 2 * pad);

  nodes.forEach((n) => {
    const scatterX = nx(n.x_value);
    const scatterY = ny(n.y_value);
    const ci = cats.indexOf(n.category || "Other");
    const cols = Math.ceil(Math.sqrt(Math.max(cats.length, 1)));
    const rows = Math.ceil(cats.length / cols);
    const cx = pad + ((ci % cols) + 0.5) * ((width - 2 * pad) / cols);
    const cy =
      pad + (Math.floor(ci / cols) + 0.5) * ((height - 2 * pad) / rows);
    const jitter =
      ((hashStr(n.entity_id) - 5e8) / 1e9) * Math.min(width, height) * 0.06;
    if (mode === "scatter") {
      n._x = scatterX;
      n._y = scatterY;
    } else if (mode === "cluster") {
      n._x = cx + jitter;
      n._y = cy + jitter * 0.7;
    } else {
      n._x = scatterX * 0.65 + cx * 0.35 + jitter * 0.5;
      n._y = scatterY * 0.65 + cy * 0.35 + jitter * 0.4;
    }
  });

  for (let iter = 0; iter < 18; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b._x - a._x;
        const dy = b._y - a._y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minD = (a._r + b._r) * 0.92;
        if (dist < minD) {
          const push = (minD - dist) * 0.5;
          const ux = dx / dist;
          const uy = dy / dist;
          a._x -= ux * push;
          a._y -= uy * push;
          b._x += ux * push;
          b._y += uy * push;
        }
      }
    }
  }

  nodes.forEach((n) => {
    const margin = n._r + 8;
    n._x = Math.min(width - margin, Math.max(margin, n._x));
    n._y = Math.min(height - margin, Math.max(margin, n._y));
  });
}

function blobPath(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  variation: number,
): Array<[number, number]> {
  const pts = 8;
  const v = Math.max(0, Math.min(1, variation || 0.35));
  const path: Array<[number, number]> = [];
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    // Static organic outline — no time-based rotation/wobble in preview.
    const wobble =
      1 +
      v * 0.35 * Math.sin(ang * 3 + seed) +
      v * 0.2 * Math.cos(ang * 2 - seed);
    path.push([cx + Math.cos(ang) * r * wobble, cy + Math.sin(ang) * r * wobble]);
  }
  return path;
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  path: Array<[number, number]>,
  fill: string,
  stroke: string,
  lineW: number,
): void {
  if (path.length < 3) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 0; i < path.length; i++) {
    const p1 = path[(i + 1) % path.length];
    const p2 = path[(i + 2) % path.length];
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;
    ctx.quadraticCurveTo(p1[0], p1[1], mx, my);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.stroke();
}

/**
 * Draws a static amoeba story frame for the VDAB canvas preview (no animation).
 */
export function drawAmoebaFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: IAmoebaPayload,
): void {
  const cfg = payload.visualConfig;
  const records = payload.records;
  if (records.length === 0) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const sizes = records.map((r) => r.size_value);
  const minS = Math.min(...sizes);
  const maxS = Math.max(...sizes);
  const nodes: ILaidOutAmoeba[] = records.map((r) => ({
    ...r,
    _x: 0,
    _y: 0,
    _r: scaleSize(r.size_value, minS, maxS, cfg),
    _seed: hashStr(r.entity_id) * 0.001,
  }));
  layout(nodes, width, height, cfg);

  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#061827");
  g.addColorStop(1, "#0a2a3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  nodes.forEach((n) => {
    const base =
      cfg.color_by === "health_score" && n.health_score != null
        ? healthColor(n.health_score)
        : catColor(n.category);
    const fill = `rgba(${toRgb(base)},0.72)`;
    const path = blobPath(n._x, n._y, n._r, n._seed, cfg.shape_variation);
    drawBlob(ctx, path, fill, "rgba(255,255,255,.18)", 2);

    const labelMode = (cfg.label_mode || "compact").toLowerCase();
    if (labelMode !== "none") {
      ctx.fillStyle = "#f0f9ff";
      ctx.font = "600 11px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = n.entity_label || n.entity_id;
      const short = label.length > 14 ? `${label.slice(0, 12)}…` : label;
      ctx.fillText(short, n._x, n._y - (labelMode === "full" ? 6 : 0));
      if (labelMode === "full") {
        ctx.font = "10px system-ui,sans-serif";
        ctx.fillStyle = "rgba(226,246,255,.85)";
        const ch = n.change_value;
        ctx.fillText(
          `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`,
          n._x,
          n._y + 10,
        );
      }
    }
  });
}
