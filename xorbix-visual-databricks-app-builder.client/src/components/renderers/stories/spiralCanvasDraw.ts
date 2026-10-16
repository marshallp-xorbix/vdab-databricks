export interface ISpiralRecord {
  journey_name: string;
  stage: string;
  timeline?: string | null;
  progress_pct: number;
  metric_value: number;
  target_date?: string;
  actual_date?: string;
  schedule_variance_days?: number;
  status?: string;
  risk_score?: number;
  owner?: string;
  key_achievement?: string;
  cost?: number;
}

export interface ISpiralVisualConfig {
  show_labels: boolean;
  show_risk_glow: boolean;
  show_variance: boolean;
  space_by_timeline: boolean;
}

export interface ISpiralSummary {
  journey_name: string;
  milestone_count: number;
  current_stage: string | null;
  avg_progress: number;
  highest_value_milestone: { stage: string; metric_value: number } | null;
  delayed_count: number;
  warnings: string[];
}

export interface ISpiralPayload {
  records: ISpiralRecord[];
  journeys?: string[];
  selected_journey?: string;
  visualConfig: ISpiralVisualConfig;
  summary: ISpiralSummary;
}

interface ILayout {
  w: number;
  h: number;
  p: { l: number; r: number; t: number; b: number };
}

interface IMarker {
  key: string;
  rec: ISpiralRecord;
  x: number;
  y: number;
  markerR: number;
}

interface ISpiralScene {
  markers: IMarker[];
  cx: number;
  cy: number;
  a: number;
  b: number;
  turns: number;
}

const RISK_THRESHOLD = 70;
const STATUS_STROKE: Record<string, string> = {
  complete: "#34d399",
  active: "#38bdf8",
  delayed: "#fbbf24",
  blocked: "#f87171",
  not_started: "rgba(148,163,184,.55)",
};

function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function layout(width: number, height: number): ILayout {
  return { w: width, h: height, p: { l: 24, r: 24, t: 20, b: 36 } };
}

function normalizeStatus(s: unknown): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function activeRecords(payload: ISpiralPayload): ISpiralRecord[] {
  const all = payload.records ?? [];
  const selected = String(payload.selected_journey || "").trim();
  if (!selected) {
    return all;
  }
  return all.filter((r) => String(r.journey_name) === selected);
}

function computeSummary(
  recs: ISpiralRecord[],
  journeyName: string,
): ISpiralSummary {
  const sorted = sortedRecords(recs);
  const warnings: string[] = [];
  if (sorted.length > 0 && sorted.length < 3) {
    warnings.push(
      "Fewer than 3 milestones — spiral story may be less meaningful.",
    );
  }
  let current: string | null = null;
  for (const r of sorted) {
    if (normalizeStatus(r.status) !== "not_started") {
      current = r.stage;
    }
  }
  if (current == null && sorted.length) {
    current = sorted[sorted.length - 1].stage;
  }
  let highest: ISpiralRecord | null = null;
  for (const r of sorted) {
    if (!highest || num(r.metric_value, 0) > num(highest.metric_value, 0)) {
      highest = r;
    }
  }
  const avg = sorted.length
    ? sorted.reduce((sum, r) => sum + num(r.progress_pct, 0), 0) / sorted.length
    : 0;
  const delayed = sorted.filter(
    (r) =>
      normalizeStatus(r.status) === "delayed" ||
      num(r.schedule_variance_days, 0) > 0,
  ).length;
  return {
    journey_name: journeyName || "",
    milestone_count: sorted.length,
    current_stage: current,
    avg_progress: avg,
    highest_value_milestone: highest
      ? { stage: highest.stage, metric_value: highest.metric_value }
      : null,
    delayed_count: delayed,
    warnings,
  };
}

function sortedRecords(records: ISpiralRecord[]): ISpiralRecord[] {
  return [...records].sort((a, b) =>
    String(a.timeline || "").localeCompare(String(b.timeline || "")),
  );
}

function parseTimelineValue(raw: unknown): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const s = String(raw).trim();
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) {
    return ms;
  }
  const n = Number(s);
  if (Number.isFinite(n)) {
    return n;
  }
  return null;
}

/**
 * Returns 0..1 placement fractions along the spiral for each sorted record.
 * Kept in sync with SpiralStreamlitHtmlHelper.placementFractions.
 */
function placementFractions(
  sorted: ISpiralRecord[],
  spaceByTimeline: boolean,
): number[] {
  const n = sorted.length;
  if (n <= 1) {
    return [0];
  }
  const equal = (): number[] => sorted.map((_, i) => i / (n - 1));
  if (!spaceByTimeline) {
    return equal();
  }

  const parsed = sorted.map((r) => parseTimelineValue(r.timeline));
  let values: number[];
  if (parsed.every((v) => v != null)) {
    values = parsed as number[];
  } else {
    const unique: string[] = [];
    for (const r of sorted) {
      const key = String(r.timeline || "");
      if (!unique.includes(key)) {
        unique.push(key);
      }
    }
    unique.sort((a, b) => a.localeCompare(b));
    const rank = new Map(unique.map((k, i) => [k, i]));
    values = sorted.map((r) => rank.get(String(r.timeline || "")) ?? 0);
  }

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  if (maxV === minV) {
    return equal();
  }
  return values.map((v) => (v - minV) / (maxV - minV));
}

function buildMarkers(
  L: ILayout,
  records: ISpiralRecord[],
  spaceByTimeline: boolean,
): ISpiralScene {
  const sorted = sortedRecords(records);
  const n = sorted.length;
  const metrics = sorted.map((r) => num(r.metric_value, 0));
  const minM = metrics.length ? Math.min(...metrics) : 0;
  const maxM = metrics.length ? Math.max(...metrics) : 1;
  const spanM = Math.max(1, maxM - minM);
  const cx = L.w / 2;
  const cy = (L.p.t + (L.h - L.p.b)) / 2;
  const maxR = Math.min(L.w, L.h - L.p.t - L.p.b) * 0.38;
  const a = maxR * 0.08;
  const turns = Math.max(1.6, Math.min(2.8, 1.2 + n * 0.18));
  const b = (maxR - a) / (turns * Math.PI * 2);
  const fracs = placementFractions(sorted, spaceByTimeline);
  const markers: IMarker[] = [];
  for (let i = 0; i < n; i++) {
    const rec = sorted[i];
    const t = fracs[i];
    const theta = t * turns * Math.PI * 2;
    const radius = a + b * theta;
    const x = cx + radius * Math.cos(theta - Math.PI / 2);
    const y = cy + radius * Math.sin(theta - Math.PI / 2);
    const metricT = (num(rec.metric_value, 0) - minM) / spanM;
    const markerR = 10 + metricT * 14;
    markers.push({
      key: `${String(rec.stage)}|${i}`,
      rec,
      x,
      y,
      markerR,
    });
  }
  return { markers, cx, cy, a, b, turns };
}

function drawSpiralPath(
  ctx: CanvasRenderingContext2D,
  scene: ISpiralScene,
): void {
  ctx.beginPath();
  const steps = Math.max(80, Math.floor(scene.turns * 64));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * scene.turns * Math.PI * 2;
    const r = scene.a + scene.b * theta;
    const x = scene.cx + r * Math.cos(theta - Math.PI / 2);
    const y = scene.cy + r * Math.sin(theta - Math.PI / 2);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = "rgba(56,189,248,.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  m: IMarker,
  cfg: ISpiralVisualConfig,
  highlighted: boolean,
): void {
  const rec = m.rec;
  const progress = Math.max(0, Math.min(100, num(rec.progress_pct, 0))) / 100;
  const status = normalizeStatus(rec.status);
  const risk = num(rec.risk_score, -1);
  const variance = num(rec.schedule_variance_days, 0);

  if (cfg.show_risk_glow && risk >= RISK_THRESHOLD) {
    const grd = ctx.createRadialGradient(
      m.x,
      m.y,
      m.markerR * 0.4,
      m.x,
      m.y,
      m.markerR * 2.2,
    );
    grd.addColorStop(0, "rgba(248,113,113,.35)");
    grd.addColorStop(1, "rgba(248,113,113,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.markerR * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,23,42,.92)";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.clip();
  const top = m.y + m.markerR;
  const fillH = m.markerR * 2 * progress;
  ctx.fillStyle = highlighted
    ? "rgba(224,242,254,.85)"
    : "rgba(56,189,248,.55)";
  ctx.fillRect(m.x - m.markerR, top - fillH, m.markerR * 2, fillH);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.lineWidth = highlighted ? 2.5 : 2;
  ctx.strokeStyle =
    STATUS_STROKE[status] ||
    (highlighted ? "#e0f2fe" : "rgba(148,163,184,.7)");
  ctx.stroke();

  if (cfg.show_variance && variance > 0) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.markerR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,191,36,.75)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (cfg.show_labels) {
    const label = String(rec.stage || "");
    ctx.fillStyle = "rgba(226,246,255,.92)";
    ctx.font = "600 11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      label.length > 18 ? `${label.slice(0, 17)}…` : label,
      m.x,
      m.y - m.markerR - 6,
    );
  }
}

/**
 * Draws one Spiral Story frame (kept in sync with SpiralStreamlitHtmlHelper).
 */
export function drawSpiralFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: ISpiralPayload,
): void {
  const cfg = payload.visualConfig;
  const records = activeRecords(payload);
  const selectedJourney =
    String(payload.selected_journey || "").trim() ||
    (records[0]?.journey_name ?? "");
  const summary = computeSummary(records, selectedJourney);
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

  const scene = buildMarkers(L, records, !!cfg.space_by_timeline);
  drawSpiralPath(ctx, scene);
  for (const m of scene.markers) {
    drawMarker(ctx, m, cfg, false);
  }

  let footer = "";
  if (summary.current_stage) {
    footer = `Current: ${String(summary.current_stage)}`;
  }
  if (summary.highest_value_milestone?.stage) {
    footer += `${footer ? " · " : ""}Highest value: ${summary.highest_value_milestone.stage}`;
  }
  if (summary.journey_name) {
    footer += `${footer ? " · " : ""}${String(summary.journey_name)}`;
  }
  if (footer) {
    ctx.fillStyle = "rgba(226,246,255,.45)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(footer.slice(0, 140), L.p.l, L.h - 12);
  }
}
