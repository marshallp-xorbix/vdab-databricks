import { STORY_CATEGORY_COLORS } from "./storyColorUtils";

export interface IHoneycombRecord {
  item_name: string;
  impact_score: number;
  priority_level: string;
  progress_pct: number;
  category: string;
  trend?: string;
  risk_score?: number;
  owner?: string;
  due_date?: string;
  investment?: number;
  benefit_value?: number;
  notes?: string;
  status?: string;
  delivery_health?: string;
}

export interface IHoneycombVisualConfig {
  show_labels: boolean;
  show_risk_borders: boolean;
  show_trend_arrows: boolean;
}

export interface IHoneycombSummary {
  item_count: number;
  category_count: number;
  avg_progress: number;
  high_impact_low_progress: Array<{
    item_name: string;
    impact_score: number;
    progress_pct: number;
  }>;
  highest_risk: { item_name: string; risk_score: number } | null;
  delivery_health: {
    on_track: number;
    at_risk: number;
    behind: number;
  } | null;
  warnings: string[];
}

export interface IHoneycombPayload {
  records: IHoneycombRecord[];
  visualConfig: IHoneycombVisualConfig;
  summary: IHoneycombSummary;
}

interface ILayout {
  w: number;
  h: number;
  p: { l: number; r: number; t: number; b: number };
}

interface IHexCell {
  key: string;
  rec: IHoneycombRecord;
  cat: string;
  catIndex: number;
  cx: number;
  cy: number;
  radius: number;
  color: string;
}

const CAT_COLORS = [...STORY_CATEGORY_COLORS];
const RISK_THRESHOLD = 70;
const PREFERRED_RADIUS = 58;
const CLUSTER_GAP = 40;
const LABEL_GAP = 22;
/** Horizontal/vertical pitch > √3·R / 1.5·R so hexes leave a readable gap. */
const HEX_STEP_X = 2.2;
const HEX_STEP_Y = 1.95;

function layout(width: number, height: number): ILayout {
  return {
    w: width,
    h: height,
    p: { l: 24, r: 24, t: 20, b: 36 },
  };
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) {
    return `rgba(56,189,248,${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function priorityWeight(priority: string): number {
  const s = String(priority || "").toLowerCase();
  if (s === "high" || s === "1" || s === "5") {
    return 2.5;
  }
  if (s === "medium" || s === "med" || s === "2" || s === "3" || s === "4") {
    return 1.75;
  }
  return 1.25;
}

function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * (Math.PI / 3);
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

interface IClusterLabel {
  cat: string;
  catIndex: number;
  x: number;
  y: number;
}

/**
 * Content-sized hexes packed into tight category clusters, then centered in the viewport.
 */
function buildCells(records: IHoneycombRecord[]): {
  cells: IHexCell[];
  labels: IClusterLabel[];
  boardW: number;
  boardH: number;
} {
  const byCat: Record<string, IHoneycombRecord[]> = {};
  for (const rec of records) {
    const cat = String(rec.category || "Other");
    if (!byCat[cat]) {
      byCat[cat] = [];
    }
    byCat[cat].push(rec);
  }
  const categories = Object.keys(byCat).sort((a, b) => a.localeCompare(b));
  for (const cat of categories) {
    byCat[cat].sort(
      (a, b) => num(b.impact_score, 0) - num(a.impact_score, 0),
    );
  }
  const impacts = records.map((r) => num(r.impact_score, 0));
  const minI = impacts.length ? Math.min(...impacts) : 0;
  const maxI = impacts.length ? Math.max(...impacts) : 1;
  const spanI = Math.max(1, maxI - minI);
  const catCount = Math.max(1, categories.length);
  const cols = catCount <= 1 ? 1 : catCount <= 3 ? catCount : 2;
  const rows = Math.ceil(catCount / cols);

  const clusters = categories.map((cat, catIndex) => {
    const items = byCat[cat];
    const n = items.length;
    const gridCols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const baseR = Math.max(44, Math.min(PREFERRED_RADIUS, 68 - gridCols * 2));
    const stepX = baseR * HEX_STEP_X;
    const stepY = baseR * HEX_STEP_Y;
    const locals: Array<{
      rec: IHoneycombRecord;
      cx: number;
      cy: number;
      radius: number;
    }> = [];
    items.forEach((rec, i) => {
      const gx = i % gridCols;
      const gy = Math.floor(i / gridCols);
      const t = (num(rec.impact_score, 0) - minI) / spanI;
      const radius = baseR * (0.82 + 0.35 * t);
      const cx = gx * stepX + (gy % 2 ? stepX * 0.5 : 0);
      const cy = gy * stepY;
      locals.push({ rec, cx, cy, radius });
    });
    const minX = Math.min(...locals.map((c) => c.cx - c.radius));
    const maxX = Math.max(...locals.map((c) => c.cx + c.radius));
    const minY = Math.min(...locals.map((c) => c.cy - c.radius));
    const maxY = Math.max(...locals.map((c) => c.cy + c.radius));
    return {
      cat,
      catIndex,
      locals,
      width: Math.max(120, maxX - minX),
      height: Math.max(80, maxY - minY) + LABEL_GAP,
      originX: minX,
      originY: minY - LABEL_GAP,
    };
  });

  const colWidths = Array.from({ length: cols }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  clusters.forEach((cluster, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], cluster.width);
    rowHeights[row] = Math.max(rowHeights[row], cluster.height);
  });
  const boardW =
    colWidths.reduce((sum, value) => sum + value, 0) +
    CLUSTER_GAP * Math.max(0, cols - 1);
  const boardH =
    rowHeights.reduce((sum, value) => sum + value, 0) +
    CLUSTER_GAP * Math.max(0, rows - 1);

  const cells: IHexCell[] = [];
  const labels: IClusterLabel[] = [];
  clusters.forEach((cluster, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let ox = 0;
    let oy = 0;
    for (let c = 0; c < col; c++) {
      ox += colWidths[c] + CLUSTER_GAP;
    }
    for (let r = 0; r < row; r++) {
      oy += rowHeights[r] + CLUSTER_GAP;
    }
    ox += (colWidths[col] - cluster.width) / 2;
    oy += (rowHeights[row] - cluster.height) / 2;
    labels.push({
      cat: cluster.cat,
      catIndex: cluster.catIndex,
      x: ox,
      y: oy + 12,
    });
    for (const local of cluster.locals) {
      cells.push({
        key: String(local.rec.item_name),
        rec: local.rec,
        cat: cluster.cat,
        catIndex: cluster.catIndex,
        cx: ox + (local.cx - cluster.originX),
        cy: oy + (local.cy - cluster.originY),
        radius: local.radius,
        color: CAT_COLORS[cluster.catIndex % CAT_COLORS.length],
      });
    }
  });

  // Centering is applied by the caller.
  return { cells, labels, boardW, boardH };
}

function wrapLabelLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(" ");
        lines.push(rest);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function fitHexName(
  ctx: CanvasRenderingContext2D,
  name: string,
  maxWidth: number,
): { lines: string[]; fontSize: number } {
  const maxFont = 12;
  const minFont = 8;
  for (let fontSize = maxFont; fontSize >= minFont; fontSize--) {
    ctx.font = `600 ${fontSize}px system-ui,sans-serif`;
    if (ctx.measureText(name).width <= maxWidth) {
      return { lines: [name], fontSize };
    }
    const lines = wrapLabelLines(ctx, name, maxWidth, 2);
    if (
      lines.length > 0 &&
      lines.every((line) => ctx.measureText(line).width <= maxWidth)
    ) {
      return { lines, fontSize };
    }
  }
  ctx.font = `600 ${minFont}px system-ui,sans-serif`;
  let lines = wrapLabelLines(ctx, name, maxWidth, 2);
  if (!lines.length) {
    lines = [name];
  }
  lines = lines.map((line) => {
    if (ctx.measureText(line).width <= maxWidth) {
      return line;
    }
    let trimmed = line;
    while (
      trimmed.length > 1 &&
      ctx.measureText(`${trimmed}…`).width > maxWidth
    ) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  });
  return { lines, fontSize: minFont };
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  cell: IHexCell,
  cfg: IHoneycombVisualConfig,
  highlighted: boolean,
): void {
  const rec = cell.rec;
  const progress = Math.max(0, Math.min(100, num(rec.progress_pct, 0))) / 100;
  hexPath(ctx, cell.cx, cell.cy, cell.radius);
  ctx.fillStyle = "rgba(15,23,42,.92)";
  ctx.fill();
  ctx.save();
  hexPath(ctx, cell.cx, cell.cy, cell.radius);
  ctx.clip();
  const top = cell.cy + cell.radius;
  const fillH = cell.radius * 2 * progress;
  ctx.fillStyle = highlighted
    ? "rgba(224,242,254,.8)"
    : hexToRgba(cell.color, 0.55);
  ctx.fillRect(cell.cx - cell.radius, top - fillH, cell.radius * 2, fillH);
  ctx.restore();
  hexPath(ctx, cell.cx, cell.cy, cell.radius);
  const risk = num(rec.risk_score, -1);
  const highRisk = cfg.show_risk_borders && risk >= RISK_THRESHOLD;
  ctx.lineWidth = highRisk ? 2.75 : priorityWeight(rec.priority_level);
  ctx.strokeStyle = highRisk
    ? "#f87171"
    : highlighted
      ? "#e0f2fe"
      : "rgba(148,163,184,.65)";
  ctx.stroke();

  if (cfg.show_labels) {
    // Usable width inside pointy-top hex (~√3·R with padding).
    const maxWidth = cell.radius * 1.45;
    const name = String(rec.item_name || "");
    const fitted = fitHexName(ctx, name, maxWidth);
    const lineHeight = fitted.fontSize + 2;
    const blockHeight = fitted.lines.length * lineHeight;
    const nameTop = cell.cy - blockHeight / 2 - 4;
    ctx.fillStyle = "rgba(226,246,255,.95)";
    ctx.font = `600 ${fitted.fontSize}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    fitted.lines.forEach((line, index) => {
      ctx.fillText(line, cell.cx, nameTop + index * lineHeight);
    });
    ctx.fillStyle = "rgba(148,163,184,.95)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${Math.round(num(rec.progress_pct, 0))}%`,
      cell.cx,
      nameTop + blockHeight + 2,
    );
  }

  if (cfg.show_trend_arrows && rec.trend) {
    const t = String(rec.trend).toLowerCase();
    let arrow = "";
    if (t.includes("improv") || t === "up" || t === "rising") {
      arrow = "↑";
    } else if (t.includes("declin") || t === "down" || t === "falling") {
      arrow = "↓";
    } else if (t.includes("flat") || t === "stable") {
      arrow = "→";
    }
    if (arrow) {
      ctx.fillStyle =
        arrow === "↑"
          ? "#34d399"
          : arrow === "↓"
            ? "#f87171"
            : "rgba(148,163,184,.9)";
      ctx.font = "700 20px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        arrow,
        cell.cx + cell.radius * 0.58,
        cell.cy - cell.radius * 0.62,
      );
    }
  }
}

/**
 * Draws one Honeycomb Story frame (kept in sync with HoneycombStreamlitHtmlHelper).
 */
export function drawHoneycombFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: IHoneycombPayload,
): void {
  const cfg = payload.visualConfig;
  const records = payload.records ?? [];
  const summary = payload.summary;
  const L = layout(width, height);

  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, L.w, L.h);

  if (records.length === 0) {
    ctx.fillStyle = "rgba(148,163,184,.8)";
    ctx.textAlign = "center";
    ctx.fillText("No data", L.w / 2, L.h / 2);
    return;
  }

  const scene = buildCells(records);
  const originX = (L.w - scene.boardW) / 2;
  const originY = (L.h - scene.boardH) / 2 - 4;

  ctx.save();
  ctx.translate(originX, originY);

  for (const label of scene.labels) {
    ctx.fillStyle = hexToRgba(
      CAT_COLORS[label.catIndex % CAT_COLORS.length],
      0.95,
    );
    ctx.font = "600 12px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label.cat, label.x, label.y);
  }

  for (const cell of scene.cells) {
    drawHex(ctx, cell, cfg, false);
  }
  ctx.restore();

  let footer = "";
  const hilp = Array.isArray(summary.high_impact_low_progress)
    ? summary.high_impact_low_progress
    : [];
  if (hilp.length) {
    footer = `High impact / low progress: ${hilp
      .map((x) => x.item_name)
      .slice(0, 3)
      .join(", ")}`;
  } else if (summary.highest_risk) {
    footer = `Highest risk: ${summary.highest_risk.item_name} (${Math.round(num(summary.highest_risk.risk_score, 0))})`;
  }
  if (summary.delivery_health) {
    const dh = summary.delivery_health;
    footer += `${footer ? " · " : ""}Health: ${dh.on_track || 0} on track, ${dh.at_risk || 0} at risk, ${dh.behind || 0} behind`;
  }
  if (footer) {
    ctx.fillStyle = "rgba(226,246,255,.45)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(footer.slice(0, 140), L.p.l, L.h - 12);
  }
}
