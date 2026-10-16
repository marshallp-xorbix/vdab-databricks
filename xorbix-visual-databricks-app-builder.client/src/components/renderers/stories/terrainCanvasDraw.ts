/**
 * Terrain Story canvas drawing for the builder preview.
 * Surface/ridge/heat algorithm kept in sync with TerrainStreamlitHtmlHelper.cs.
 */

import { catColor, riskColor } from "./storyColorUtils";

export interface ITerrainRecord {
  x: string;
  y: string;
  height: number;
  category?: string;
  risk_score?: number;
  target_value?: number;
  baseline_value?: number;
  variance?: number;
  status?: string;
}

export interface ITerrainCallout {
  x: string;
  y: string;
  label: string;
  metric_value: number;
  description?: string;
}

export interface ITerrainVisualConfig {
  terrain_mode: string;
  color_by: string;
  height_scale: number;
  show_peak_labels: boolean;
  show_valley_labels: boolean;
  interpolation: string;
  grid_resolution: number;
  camera_preset: string;
}

export interface ITerrainPayload {
  records: ITerrainRecord[];
  callouts: ITerrainCallout[];
  visualConfig: ITerrainVisualConfig;
  summary: {
    top_peaks: Array<{ x: string; y: string; height: number }>;
    bottom_valleys: Array<{ x: string; y: string; height: number }>;
  };
}

interface IGrid {
  xs: string[];
  ys: string[];
  map: Map<string, ITerrainRecord>;
  minH: number;
  maxH: number;
}

interface IDenseMesh {
  dense: Array<Array<number | null>>;
  denseCols: number;
  denseRows: number;
}

interface ISurfaceLayout {
  originX: number;
  originY: number;
  cellW: number;
  cellH: number;
  baseElev: number;
  elevMul: number;
  xSkew: number;
  minH: number;
  maxH: number;
}

interface IPoint {
  x: number;
  y: number;
  elev: number;
}

const MAX_DENSE = 80;

function cellKey(x: string, y: string): string {
  return `${x}|${y}`;
}

function heightColor(t: number): string {
  const stops: Array<[number, string]> = [
    [0, "#0c4a6e"],
    [0.25, "#0e7490"],
    [0.5, "#14b8a6"],
    [0.75, "#fbbf24"],
    [1, "#f97316"],
  ];
  const clamped = Math.max(0, Math.min(1, t));
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

function darkenRgb(css: string, factor: number): string {
  const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return css;
  const f = Math.max(0, Math.min(1, factor));
  return `rgb(${Math.round(+m[1] * f)},${Math.round(+m[2] * f)},${Math.round(+m[3] * f)})`;
}

function buildGrid(records: ITerrainRecord[]): IGrid {
  const xs = [...new Set(records.map((r) => r.x))];
  const ys = [...new Set(records.map((r) => r.y))];
  const map = new Map(records.map((r) => [cellKey(r.x, r.y), r]));
  const heights = records.map((r) => r.height);
  const minH = heights.length ? Math.min(...heights) : 0;
  const maxH = heights.length ? Math.max(...heights) : 1;
  return { xs, ys, map, minH, maxH };
}

function cellFill(
  rec: ITerrainRecord,
  minH: number,
  maxH: number,
  cfg: ITerrainVisualConfig,
): string {
  const mode = (cfg.color_by || "height_metric").toLowerCase();
  if (mode === "risk_score") return riskColor(rec.risk_score ?? 0);
  if (mode === "variance") {
    const v = rec.variance ?? 0;
    const t = 0.5 + Math.max(-0.5, Math.min(0.5, v / (maxH - minH || 1)));
    return heightColor(t);
  }
  if (mode === "category") return catColor(rec.category || "Other");
  const t = (rec.height - minH) / (maxH - minH || 1);
  return heightColor(
    Math.pow(Math.max(0, t), 1 / Math.max(cfg.height_scale, 0.1)),
  );
}

function heightNormColor(
  h: number,
  minH: number,
  maxH: number,
  heightScale: number,
): string {
  const t = (h - minH) / (maxH - minH || 1);
  return heightColor(
    Math.pow(Math.max(0, Math.min(1, t)), 1 / Math.max(heightScale, 0.1)),
  );
}

function sparseHeights(grid: IGrid): Array<Array<number | null>> {
  const rows = grid.ys.length;
  const cols = grid.xs.length;
  const H: Array<Array<number | null>> = Array.from({ length: rows }, () =>
    Array(cols).fill(null),
  );
  for (let yi = 0; yi < rows; yi++) {
    for (let xi = 0; xi < cols; xi++) {
      const rec = grid.map.get(cellKey(grid.xs[xi], grid.ys[yi]));
      if (rec) H[yi][xi] = rec.height;
    }
  }
  return H;
}

function sampleSparse(
  H: Array<Array<number | null>>,
  fx: number,
  fy: number,
): number | null {
  const rows = H.length;
  const cols = H[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = H[y0][x0];
  const v10 = H[y0][x1];
  const v01 = H[y1][x0];
  const v11 = H[y1][x1];
  const known = [v00, v10, v01, v11].filter((v) => v != null);
  if (!known.length) return null;
  const a = v00 ?? v10 ?? v01 ?? v11!;
  const b = v10 ?? v00 ?? v11 ?? v01!;
  const c = v01 ?? v00 ?? v11 ?? v10!;
  const d = v11 ?? v10 ?? v01 ?? v00!;
  const top = a + (b - a) * tx;
  const bot = c + (d - c) * tx;
  return top + (bot - top) * ty;
}

function buildDense(grid: IGrid, cfg: ITerrainVisualConfig): IDenseMesh {
  const sparse = sparseHeights(grid);
  const rows = grid.ys.length;
  const cols = grid.xs.length;
  const useBilinear = (cfg.interpolation || "bilinear").toLowerCase() === "bilinear";
  const want = Math.min(
    MAX_DENSE,
    Math.max(10, Math.floor(cfg.grid_resolution || 60)),
  );
  let denseCols = cols;
  let denseRows = rows;
  if (useBilinear && Math.max(cols, rows) > 1) {
    if (cols >= rows) {
      denseCols = Math.max(cols, want);
      denseRows = Math.max(
        rows,
        Math.round(want * (rows / Math.max(cols, 1))),
      );
    } else {
      denseRows = Math.max(rows, want);
      denseCols = Math.max(
        cols,
        Math.round(want * (cols / Math.max(rows, 1))),
      );
    }
    denseCols = Math.min(MAX_DENSE, denseCols);
    denseRows = Math.min(MAX_DENSE, denseRows);
  }
  const dense: Array<Array<number | null>> = Array.from(
    { length: denseRows },
    () => Array(denseCols).fill(null),
  );
  for (let yi = 0; yi < denseRows; yi++) {
    for (let xi = 0; xi < denseCols; xi++) {
      const fx = cols <= 1 ? 0 : (xi / (denseCols - 1)) * (cols - 1);
      const fy = rows <= 1 ? 0 : (yi / (denseRows - 1)) * (rows - 1);
      if (useBilinear) {
        dense[yi][xi] = sampleSparse(sparse, fx, fy);
      } else {
        const sx = Math.round(fx);
        const sy = Math.round(fy);
        dense[yi][xi] = sparse[sy]?.[sx] ?? null;
      }
    }
  }
  return { dense, denseCols, denseRows };
}

function cameraFactors(preset: string): {
  xSkew: number;
  yDepth: number;
  elevMul: number;
} {
  const cam = (preset || "angled").toLowerCase();
  if (cam === "front") return { xSkew: 0.15, yDepth: 0.55, elevMul: 1.15 };
  if (cam === "top") return { xSkew: 0.55, yDepth: 0.35, elevMul: 0.45 };
  return { xSkew: 0.55, yDepth: 0.42, elevMul: 1 };
}

function projectIso(
  xi: number,
  yi: number,
  h: number,
  layout: ISurfaceLayout,
  heightScale: number,
): IPoint {
  const elev =
    ((h - layout.minH) / (layout.maxH - layout.minH || 1)) *
    layout.baseElev *
    layout.elevMul *
    heightScale;
  const sx = layout.originX + (xi - yi * layout.xSkew) * layout.cellW;
  const sy = layout.originY + (xi + yi) * layout.cellH - elev;
  return { x: sx, y: sy, elev };
}

function sparseToDenseCoord(
  si: number,
  sparseCount: number,
  denseCount: number,
): number {
  if (sparseCount <= 1) return 0;
  return (si / (sparseCount - 1)) * (denseCount - 1);
}

function drawHeat(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: IGrid,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const padL = 8;
  const padT = 8;
  const padR = 8;
  const padB = 8;
  const cw = (width - padL - padR) / grid.xs.length;
  const ch = (height - padT - padB) / grid.ys.length;

  grid.ys.forEach((y, yi) => {
    grid.xs.forEach((x, xi) => {
      const rec = grid.map.get(cellKey(x, y));
      ctx.fillStyle = rec
        ? cellFill(rec, grid.minH, grid.maxH, cfg)
        : "rgba(30,41,59,.5)";
      ctx.fillRect(padL + xi * cw + 1, padT + yi * ch + 1, cw - 2, ch - 2);
    });
  });

  drawMarkersHeat(ctx, grid, padL, padT, cw, ch, cfg, payload);
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: IGrid,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const pad = 24;
  const ox = width * 0.18;
  const oy = height * 0.72;
  const sx = ((width - pad * 2) / Math.max(grid.xs.length, 1)) * 0.7;
  const sy = ((height - pad * 2) / Math.max(grid.ys.length, 1)) * 0.45;
  const hz = height * 0.4 * cfg.height_scale;

  for (let yi = 0; yi < grid.ys.length; yi++) {
    for (let xi = 0; xi < grid.xs.length; xi++) {
      const x = grid.xs[xi];
      const y = grid.ys[yi];
      const rec = grid.map.get(cellKey(x, y));
      const h = rec ? rec.height : 0;
      const elev =
        ((h - grid.minH) / (grid.maxH - grid.minH || 1)) * hz;
      const px = ox + xi * sx - yi * sx * 0.45;
      const py = oy + yi * sy - elev;
      const w = sx * 0.85;
      const d = sy * 0.7;
      ctx.fillStyle = rec
        ? cellFill(rec, grid.minH, grid.maxH, cfg)
        : "#334155";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + w, py);
      ctx.lineTo(px + w * 0.55, py - d);
      ctx.lineTo(px - w * 0.35, py - d);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + w, py);
      ctx.lineTo(px + w, py + Math.max(6, elev * 0.2));
      ctx.lineTo(px, py + Math.max(6, elev * 0.2));
      ctx.closePath();
      ctx.fill();
    }
  }

  drawMarkersRidge(ctx, grid, ox, oy, sx, sy, hz, cfg, payload);
}

function drawSurface(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: IGrid,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const mesh = buildDense(grid, cfg);
  const cam = cameraFactors(cfg.camera_preset);
  const nX = mesh.denseCols;
  const nY = mesh.denseRows;
  const span = Math.max(nX, nY, 1);
  const cellW = Math.min((width * 0.72) / span, (height * 0.55) / span);
  const cellH = cellW * cam.yDepth;
  const baseElev = height * 0.4;
  const originX =
    width * 0.5 - ((nX - 1) - (nY - 1) * cam.xSkew) * cellW * 0.5;
  const originY = height * 0.62;
  const layout: ISurfaceLayout = {
    originX,
    originY,
    cellW,
    cellH,
    baseElev,
    elevMul: cam.elevMul,
    xSkew: cam.xSkew,
    minH: grid.minH,
    maxH: grid.maxH,
  };

  const g0 = projectIso(0, 0, grid.minH, layout, cfg.height_scale);
  const g1 = projectIso(nX - 1, 0, grid.minH, layout, cfg.height_scale);
  const g2 = projectIso(nX - 1, nY - 1, grid.minH, layout, cfg.height_scale);
  const g3 = projectIso(0, nY - 1, grid.minH, layout, cfg.height_scale);
  ctx.fillStyle = "rgba(15,23,42,.55)";
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y + 8);
  ctx.lineTo(g1.x, g1.y + 8);
  ctx.lineTo(g2.x, g2.y + 8);
  ctx.lineTo(g3.x, g3.y + 8);
  ctx.closePath();
  ctx.fill();

  type Face = {
    depth: number;
    avgH: number;
    p00: IPoint;
    p10: IPoint;
    p01: IPoint;
    p11: IPoint;
  };
  const faces: Face[] = [];
  for (let yi = 0; yi < nY - 1; yi++) {
    for (let xi = 0; xi < nX - 1; xi++) {
      const h00 = mesh.dense[yi][xi];
      const h10 = mesh.dense[yi][xi + 1];
      const h01 = mesh.dense[yi + 1][xi];
      const h11 = mesh.dense[yi + 1][xi + 1];
      if (h00 == null || h10 == null || h01 == null || h11 == null) continue;
      faces.push({
        depth: xi + yi,
        avgH: (h00 + h10 + h01 + h11) / 4,
        p00: projectIso(xi, yi, h00, layout, cfg.height_scale),
        p10: projectIso(xi + 1, yi, h10, layout, cfg.height_scale),
        p01: projectIso(xi, yi + 1, h01, layout, cfg.height_scale),
        p11: projectIso(xi + 1, yi + 1, h11, layout, cfg.height_scale),
      });
    }
  }
  faces.sort((a, b) => a.depth - b.depth || a.avgH - b.avgH);

  for (const f of faces) {
    const top = heightNormColor(
      f.avgH,
      grid.minH,
      grid.maxH,
      cfg.height_scale,
    );
    const side = darkenRgb(top, 0.55);
    const front = darkenRgb(top, 0.72);
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(f.p01.x, f.p01.y);
    ctx.lineTo(f.p11.x, f.p11.y);
    ctx.lineTo(f.p11.x, f.p11.y + Math.max(2, f.p11.elev * 0.08));
    ctx.lineTo(f.p01.x, f.p01.y + Math.max(2, f.p01.elev * 0.08));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = front;
    ctx.beginPath();
    ctx.moveTo(f.p10.x, f.p10.y);
    ctx.lineTo(f.p11.x, f.p11.y);
    ctx.lineTo(f.p11.x, f.p11.y + Math.max(2, f.p11.elev * 0.08));
    ctx.lineTo(f.p10.x, f.p10.y + Math.max(2, f.p10.elev * 0.08));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(f.p00.x, f.p00.y);
    ctx.lineTo(f.p10.x, f.p10.y);
    ctx.lineTo(f.p11.x, f.p11.y);
    ctx.lineTo(f.p01.x, f.p01.y);
    ctx.closePath();
    ctx.fill();
  }

  drawMarkersSurface(ctx, grid, layout, mesh, cfg, payload);
}

function drawMarkersHeat(
  ctx: CanvasRenderingContext2D,
  grid: IGrid,
  padL: number,
  padT: number,
  cw: number,
  ch: number,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const mark = (
    list: Array<{ x: string; y: string }>,
    color: string,
    prefix: string,
  ): void => {
    list.forEach((p, i) => {
      const xi = grid.xs.indexOf(p.x);
      const yi = grid.ys.indexOf(p.y);
      if (xi < 0 || yi < 0) return;
      const px = padL + xi * cw + cw / 2;
      const py = padT + yi * ch + ch / 2;
      ctx.fillStyle = "rgba(15,23,42,.75)";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`${prefix}${i + 1}`, px + 6, py + 3);
    });
  };
  if (cfg.show_peak_labels) mark(payload.summary.top_peaks, "#f97316", "P");
  if (cfg.show_valley_labels)
    mark(payload.summary.bottom_valleys, "#38bdf8", "V");
}

function drawMarkersRidge(
  ctx: CanvasRenderingContext2D,
  grid: IGrid,
  ox: number,
  oy: number,
  sx: number,
  sy: number,
  hz: number,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const mark = (
    list: Array<{ x: string; y: string; height: number }>,
    color: string,
    prefix: string,
  ): void => {
    list.forEach((p, i) => {
      const xi = grid.xs.indexOf(p.x);
      const yi = grid.ys.indexOf(p.y);
      if (xi < 0 || yi < 0) return;
      const elev =
        ((p.height - grid.minH) / (grid.maxH - grid.minH || 1)) * hz;
      const px = ox + xi * sx - yi * sx * 0.45 + sx * 0.3;
      const py = oy + yi * sy - elev - 10;
      ctx.fillStyle = "rgba(15,23,42,.75)";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`${prefix}${i + 1}`, px + 7, py + 3);
    });
  };
  if (cfg.show_peak_labels) mark(payload.summary.top_peaks, "#f97316", "P");
  if (cfg.show_valley_labels)
    mark(payload.summary.bottom_valleys, "#38bdf8", "V");
}

function drawMarkersSurface(
  ctx: CanvasRenderingContext2D,
  grid: IGrid,
  layout: ISurfaceLayout,
  mesh: IDenseMesh,
  cfg: ITerrainVisualConfig,
  payload: ITerrainPayload,
): void {
  const mark = (
    list: Array<{ x: string; y: string; height: number }>,
    color: string,
    prefix: string,
  ): void => {
    list.forEach((p, i) => {
      const xi = grid.xs.indexOf(p.x);
      const yi = grid.ys.indexOf(p.y);
      if (xi < 0 || yi < 0) return;
      const dx = sparseToDenseCoord(xi, grid.xs.length, mesh.denseCols);
      const dy = sparseToDenseCoord(yi, grid.ys.length, mesh.denseRows);
      const pt = projectIso(dx, dy, p.height, layout, cfg.height_scale);
      const px = pt.x;
      const py = pt.y - 10;
      ctx.fillStyle = "rgba(15,23,42,.75)";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0a1628";
      ctx.lineWidth = 2;
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.strokeText(`${prefix}${i + 1}`, px + 7, py + 4);
      ctx.fillText(`${prefix}${i + 1}`, px + 7, py + 4);
    });
  };
  if (cfg.show_peak_labels) mark(payload.summary.top_peaks, "#f97316", "P");
  if (cfg.show_valley_labels)
    mark(payload.summary.bottom_valleys, "#38bdf8", "V");
}

/**
 * Draws a terrain preview for the builder canvas (heat / ridge / surface).
 */
export function drawTerrainFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: ITerrainPayload,
): void {
  const { records, visualConfig: cfg } = payload;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, width, height);

  if (!records.length) {
    return;
  }

  const grid = buildGrid(records);
  if (!grid.xs.length || !grid.ys.length) {
    return;
  }

  const mode = (cfg.terrain_mode || "surface").toLowerCase();
  if (mode === "ridge") {
    drawRidge(ctx, width, height, grid, cfg, payload);
  } else if (mode === "heat_surface") {
    drawHeat(ctx, width, height, grid, cfg, payload);
  } else {
    drawSurface(ctx, width, height, grid, cfg, payload);
  }
}
