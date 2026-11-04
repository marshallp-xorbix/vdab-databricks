export interface IPulseWaveRecord {
  time_period: string;
  metric_value: number;
  baseline_value: number;
}

export interface IPulseWaveEvent {
  time_period: string;
  event_name: string;
  event_type?: string;
  impact_score?: number;
}

export interface IPulseWaveVisualConfig {
  metric_name: string;
  /** Y-axis label — typically the mapped metric column name. */
  y_axis_label: string;
  aggregation_method: string;
  show_baseline: boolean;
  show_events: boolean;
  show_anomaly_markers: boolean;
  fill_under_wave: boolean;
}

export interface IPulseWaveSummaryHighlight {
  time_period: string;
  delta: number;
}

export interface IPulseWaveSummary {
  point_count: number;
  largest_spike: IPulseWaveSummaryHighlight | null;
  largest_drop: IPulseWaveSummaryHighlight | null;
  event_count: number;
  warnings: string[];
}

export interface IPulseWavePayload {
  records: IPulseWaveRecord[];
  events: IPulseWaveEvent[];
  visualConfig: IPulseWaveVisualConfig;
  summary: IPulseWaveSummary;
}

/** Visible X window as fractions of the full series (0–1). */
export interface IPulseWaveViewWindow {
  start: number;
  end: number;
}

export const DEFAULT_PULSE_WAVE_VIEW: IPulseWaveViewWindow = {
  start: 0,
  end: 1,
};

interface ILayout {
  w: number;
  h: number;
  p: { l: number; r: number; t: number; b: number };
  iw: number;
  ih: number;
}

interface IPoint {
  x: number;
  y: number;
  globalIndex: number;
  record: IPulseWaveRecord;
}

function formatCompact(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (absolute >= 1e3) {
    return `${(value / 1e3).toFixed(1)}k`;
  }
  return Math.round(value).toString();
}

function pad(): { l: number; r: number; t: number; b: number } {
  return { l: 62, r: 18, t: 20, b: 36 };
}

function layout(width: number, height: number): ILayout {
  const p = pad();
  return {
    w: width,
    h: height,
    p,
    iw: Math.max(1, width - p.l - p.r),
    ih: Math.max(1, height - p.t - p.b),
  };
}

function clampView(view: IPulseWaveViewWindow): IPulseWaveViewWindow {
  let start = Math.max(0, Math.min(1, view.start));
  let end = Math.max(0, Math.min(1, view.end));
  if (end - start < 0.05) {
    const mid = (start + end) / 2;
    start = Math.max(0, mid - 0.025);
    end = Math.min(1, mid + 0.025);
  }
  if (end <= start) {
    return { ...DEFAULT_PULSE_WAVE_VIEW };
  }
  return { start, end };
}

function yRange(records: IPulseWaveRecord[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    min = Math.min(min, record.metric_value, record.baseline_value);
    max = Math.max(max, record.metric_value, record.baseline_value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padY = (max - min) * 0.12;
  return { min: min - padY, max: max + padY };
}

function yPos(value: number, yr: { min: number; max: number }, L: ILayout): number {
  return L.p.t + (1 - (value - yr.min) / (yr.max - yr.min || 1)) * L.ih;
}

function eventByPeriod(
  events: IPulseWaveEvent[],
): Record<string, IPulseWaveEvent> {
  const map: Record<string, IPulseWaveEvent> = {};
  for (const event of events) {
    if (event.time_period) {
      map[event.time_period] = event;
    }
  }
  return map;
}

function drawWavePath(
  ctx: CanvasRenderingContext2D,
  points: IPoint[],
  closeToBaseline: boolean,
  baseY: number,
): void {
  if (points.length === 0) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const controlX = (previous.x + current.x) / 2;
    ctx.bezierCurveTo(controlX, previous.y, controlX, current.y, current.x, current.y);
  }
  if (closeToBaseline) {
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.lineTo(points[0].x, baseY);
    ctx.closePath();
  }
}

function buildVisiblePoints(
  records: IPulseWaveRecord[],
  view: IPulseWaveViewWindow,
  L: ILayout,
  yr: { min: number; max: number },
): IPoint[] {
  const count = records.length;
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [
      {
        x: L.p.l + L.iw / 2,
        y: yPos(records[0].metric_value, yr, L),
        globalIndex: 0,
        record: records[0],
      },
    ];
  }

  const startFrac = view.start * (count - 1);
  const endFrac = view.end * (count - 1);
  const span = endFrac - startFrac || 1;
  const i0 = Math.max(0, Math.floor(startFrac));
  const i1 = Math.min(count - 1, Math.ceil(endFrac));
  const points: IPoint[] = [];
  for (let i = i0; i <= i1; i++) {
    const x = L.p.l + ((i - startFrac) / span) * L.iw;
    points.push({
      x,
      y: yPos(records[i].metric_value, yr, L),
      globalIndex: i,
      record: records[i],
    });
  }
  return points;
}

function drawYAxisLabel(
  ctx: CanvasRenderingContext2D,
  L: ILayout,
  label: string,
): void {
  const text = (label || "Metric").trim() || "Metric";
  ctx.save();
  ctx.fillStyle = "rgba(226,246,255,.85)";
  ctx.font = "11px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = 14;
  const y = L.p.t + L.ih / 2;
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Draws one Pulse Wave Story frame (kept in sync with PulseWaveStreamlitHtmlHelper).
 */
export function drawPulseWaveFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: IPulseWavePayload,
  viewWindow: IPulseWaveViewWindow = DEFAULT_PULSE_WAVE_VIEW,
): void {
  const cfg = payload.visualConfig;
  const records = payload.records ?? [];
  const events = payload.events ?? [];
  const summary = payload.summary;
  const view = clampView(viewWindow);
  const L = layout(width, height);
  const count = records.length;
  const evtMap = eventByPeriod(events);

  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, L.w, L.h);

  const visibleForScale =
    count <= 1
      ? records
      : (() => {
          const startFrac = view.start * (count - 1);
          const endFrac = view.end * (count - 1);
          const i0 = Math.max(0, Math.floor(startFrac));
          const i1 = Math.min(count - 1, Math.ceil(endFrac));
          return records.slice(i0, i1 + 1);
        })();
  const yr = yRange(visibleForScale.length ? visibleForScale : records);

  ctx.strokeStyle = "rgba(148,163,184,.18)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = L.p.t + (g / 4) * L.ih;
    ctx.beginPath();
    ctx.moveTo(L.p.l, y);
    ctx.lineTo(L.p.l + L.iw, y);
    ctx.stroke();
    const value = yr.max - (g / 4) * (yr.max - yr.min);
    ctx.fillStyle = "rgba(226,246,255,.55)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatCompact(value), L.p.l - 6, y + 3);
  }

  drawYAxisLabel(ctx, L, cfg.y_axis_label || cfg.metric_name || "Metric");

  if (count === 0) {
    ctx.fillStyle = "rgba(148,163,184,.8)";
    ctx.textAlign = "center";
    ctx.fillText("No data", L.w / 2, L.h / 2);
    return;
  }

  const points = buildVisiblePoints(records, view, L, yr);
  const baseFloor = yPos(yr.min, yr, L);

  ctx.save();
  ctx.beginPath();
  ctx.rect(L.p.l, L.p.t, L.iw, L.ih);
  ctx.clip();

  if (cfg.fill_under_wave) {
    ctx.fillStyle = "rgba(56,189,248,.16)";
    drawWavePath(ctx, points, true, baseFloor);
    ctx.fill();
  }

  if (cfg.show_baseline) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(251,191,36,.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((point, index) => {
      const y = yPos(point.record.baseline_value, yr, L);
      if (index === 0) {
        ctx.moveTo(point.x, y);
      } else {
        ctx.lineTo(point.x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.25;
  ctx.lineJoin = "round";
  drawWavePath(ctx, points, false, 0);
  ctx.stroke();

  const spikePeriod = summary.largest_spike?.time_period;
  const dropPeriod = summary.largest_drop?.time_period;
  if (cfg.show_anomaly_markers) {
    for (const point of points) {
      const period = point.record.time_period;
      if (period && (period === spikePeriod || period === dropPeriod)) {
        const isSpike = period === spikePeriod;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = isSpike ? "#4ade80" : "#f87171";
        ctx.fill();
        ctx.strokeStyle = "#0b1220";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  if (cfg.show_events) {
    for (const point of points) {
      const event = evtMap[point.record.time_period];
      if (!event) {
        continue;
      }
      const type = (event.event_type || "neutral").toLowerCase();
      const color =
        type === "positive" ? "#4ade80" : type === "negative" ? "#f87171" : "#a78bfa";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(point.x, L.p.t);
      ctx.lineTo(point.x, L.p.t + L.ih);
      ctx.stroke();
      ctx.setLineDash([]);
      const impact = event.impact_score ?? 40;
      const radius = 3 + Math.min(6, impact / 20);
      ctx.beginPath();
      ctx.arc(point.x, L.p.t + 8, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const label = (event.event_name || "").slice(0, 18);
      if (label) {
        ctx.fillStyle = "rgba(226,246,255,.8)";
        ctx.font = "9px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, point.x, L.p.t + 22);
      }
    }
  }

  ctx.restore();

  ctx.fillStyle = "rgba(226,246,255,.55)";
  ctx.font = "10px system-ui,sans-serif";
  ctx.textAlign = "center";
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  for (let i = 0; i < points.length; i += labelStep) {
    ctx.fillText(
      String(points[i].record.time_period || "").slice(0, 10),
      points[i].x,
      L.h - 12,
    );
  }
}

/**
 * Maps a canvas X coordinate to a series fraction under the current view.
 */
export function pulseWaveCanvasXToSeriesFraction(
  canvasX: number,
  width: number,
  view: IPulseWaveViewWindow,
): number {
  const L = layout(width, 100);
  const clamped = clampView(view);
  const t = (canvasX - L.p.l) / (L.iw || 1);
  return clamped.start + Math.max(0, Math.min(1, t)) * (clamped.end - clamped.start);
}

/**
 * Zooms the view window around an anchor series fraction.
 */
export function zoomPulseWaveView(
  view: IPulseWaveViewWindow,
  anchorFraction: number,
  zoomFactor: number,
): IPulseWaveViewWindow {
  const clamped = clampView(view);
  const span = clamped.end - clamped.start;
  const nextSpan = Math.max(0.05, Math.min(1, span * zoomFactor));
  const anchor = Math.max(clamped.start, Math.min(clamped.end, anchorFraction));
  const ratio = span > 0 ? (anchor - clamped.start) / span : 0.5;
  let start = anchor - ratio * nextSpan;
  let end = start + nextSpan;
  if (start < 0) {
    start = 0;
    end = nextSpan;
  }
  if (end > 1) {
    end = 1;
    start = 1 - nextSpan;
  }
  return clampView({ start, end });
}

/**
 * Pans the view window by a fraction of the current span (positive = later times).
 */
export function panPulseWaveView(
  view: IPulseWaveViewWindow,
  deltaFractionOfSpan: number,
): IPulseWaveViewWindow {
  const clamped = clampView(view);
  const span = clamped.end - clamped.start;
  let start = clamped.start + deltaFractionOfSpan * span;
  let end = start + span;
  if (start < 0) {
    start = 0;
    end = span;
  }
  if (end > 1) {
    end = 1;
    start = 1 - span;
  }
  return clampView({ start, end });
}
