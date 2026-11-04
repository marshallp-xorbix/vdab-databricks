export interface IFlowFieldStage {
  name: string;
  order: number;
}

export interface IFlowFieldFlow {
  source: string;
  destination: string;
  volume: number;
  stage_order?: number;
  conversion_pct?: number;
  drop_off?: number;
  avg_time_in_stage?: number;
  status?: string;
}

export interface IFlowFieldVisualConfig {
  show_drop_offs: boolean;
  show_labels: boolean;
}

export interface IFlowFieldSummary {
  stage_count: number;
  flow_count: number;
  total_volume: number;
  largest_drop_off: {
    source: string;
    destination: string;
    drop_off: number;
  } | null;
  bottleneck_stage: { name: string; reason: string } | null;
  warnings: string[];
}

export interface IFlowFieldPayload {
  stages: IFlowFieldStage[];
  flows: IFlowFieldFlow[];
  visualConfig: IFlowFieldVisualConfig;
  summary: IFlowFieldSummary;
}

interface ILayout {
  w: number;
  h: number;
  p: { l: number; r: number; t: number; b: number };
  iw: number;
  ih: number;
}

interface INodeBox {
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IFlowFieldLinkGeom {
  flow: IFlowFieldFlow;
  key: string;
  x0: number;
  y0Top: number;
  y0Bot: number;
  x1: number;
  y1Top: number;
  y1Bot: number;
  color: string;
}

const NODE_WIDTH = 88;
const NODE_GAP_Y = 16;
const MIN_NODE_HEIGHT = 40;
const COLUMN_INSET = 8;

function pad(): { l: number; r: number; t: number; b: number } {
  return { l: 36, r: 36, t: 24, b: 36 };
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

function statusColor(status?: string): string {
  const normalized = (status || "normal").toLowerCase();
  if (
    normalized === "delayed" ||
    normalized === "blocked" ||
    normalized === "failed"
  ) {
    return "rgba(248,113,113,.72)";
  }
  return "rgba(56,189,248,.72)";
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function flowKey(flow: IFlowFieldFlow): string {
  return `${flow.source}→${flow.destination}`;
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  link: IFlowFieldLinkGeom,
  highlighted: boolean,
): void {
  const midX = (link.x0 + link.x1) / 2;
  ctx.beginPath();
  ctx.moveTo(link.x0, link.y0Top);
  ctx.bezierCurveTo(midX, link.y0Top, midX, link.y1Top, link.x1, link.y1Top);
  ctx.lineTo(link.x1, link.y1Bot);
  ctx.bezierCurveTo(midX, link.y1Bot, midX, link.y0Bot, link.x0, link.y0Bot);
  ctx.closePath();
  ctx.fillStyle = highlighted ? "rgba(224,242,254,.88)" : link.color;
  ctx.fill();
}

/** Cubic Y for the horizontal ribbon edge used by drawRibbon (P1.y=y0, P2.y=y1). */
function ribbonEdgeY(y0: number, y1: number, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * y0 +
    3 * mt * mt * t * y0 +
    3 * mt * t * t * y1 +
    t * t * t * y1
  );
}

/**
 * True when (x,y) lies inside the filled ribbon band (full stream body, not just midpoint).
 */
export function flowFieldLinkContains(
  link: IFlowFieldLinkGeom,
  x: number,
  y: number,
): boolean {
  const minX = Math.min(link.x0, link.x1);
  const maxX = Math.max(link.x0, link.x1);
  if (x < minX - 1 || x > maxX + 1) {
    return false;
  }
  const spanX = link.x1 - link.x0;
  if (Math.abs(spanX) < 0.001) {
    return false;
  }
  const t = Math.max(0, Math.min(1, (x - link.x0) / spanX));
  const yTop = ribbonEdgeY(link.y0Top, link.y1Top, t);
  const yBot = ribbonEdgeY(link.y0Bot, link.y1Bot, t);
  const lo = Math.min(yTop, yBot) - 1;
  const hi = Math.max(yTop, yBot) + 1;
  return y >= lo && y <= hi;
}

/**
 * Picks the stream under the pointer. Prefer thinner (topmost overlapping) ribbons.
 */
export function hitTestFlowFieldLink(
  links: IFlowFieldLinkGeom[],
  x: number,
  y: number,
): IFlowFieldLinkGeom | null {
  let best: IFlowFieldLinkGeom | null = null;
  let bestThickness = Number.POSITIVE_INFINITY;
  for (const link of links) {
    if (!flowFieldLinkContains(link, x, y)) {
      continue;
    }
    const thickness =
      (Math.abs(link.y0Bot - link.y0Top) + Math.abs(link.y1Bot - link.y1Top)) /
      2;
    if (thickness <= bestThickness) {
      bestThickness = thickness;
      best = link;
    }
  }
  return best;
}

export function formatFlowFieldCompact(value: number): string {
  return formatCompact(value);
}

function buildColumns(stages: IFlowFieldStage[]): number[] {
  const orders = [...new Set(stages.map((stage) => stage.order))].sort(
    (a, b) => a - b,
  );
  return orders;
}

function nodeVolume(
  name: string,
  flows: IFlowFieldFlow[],
): number {
  let incoming = 0;
  let outgoing = 0;
  for (const flow of flows) {
    if (flow.destination === name) {
      incoming += Math.max(0, flow.volume);
    }
    if (flow.source === name) {
      outgoing += Math.max(0, flow.volume);
    }
  }
  return Math.max(incoming, outgoing, 1);
}

function dropOffByStage(flows: IFlowFieldFlow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const flow of flows) {
    const drop = flow.drop_off ?? 0;
    if (drop > 0) {
      totals[flow.source] = (totals[flow.source] || 0) + drop;
    }
  }
  return totals;
}

/**
 * Builds node boxes and ribbon geometry for Flow Field (shared by draw + hit-test).
 */
export function buildFlowFieldLinks(
  width: number,
  height: number,
  payload: IFlowFieldPayload,
): { links: IFlowFieldLinkGeom[]; nodes: Record<string, INodeBox> } {
  const stages = payload.stages ?? [];
  const flows = payload.flows ?? [];
  const L = layout(width, height);
  const columns = buildColumns(stages);
  const columnCount = columns.length;
  const columnWidth =
    columnCount <= 1 ? L.iw : L.iw / Math.max(1, columnCount - 1);
  const nodes: Record<string, INodeBox> = {};

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const order = columns[columnIndex];
    const columnStages = stages
      .filter((stage) => stage.order === order)
      .sort((a, b) => a.name.localeCompare(b.name));
    const volumes = columnStages.map((stage) =>
      nodeVolume(stage.name, flows),
    );
    const volumeSum = volumes.reduce((sum, value) => sum + value, 0) || 1;
    const usableHeight =
      L.ih - NODE_GAP_Y * Math.max(0, columnStages.length - 1);
    const x =
      columnCount <= 1
        ? L.p.l + L.iw / 2
        : L.p.l + columnIndex * columnWidth;

    let cursorY = L.p.t;
    columnStages.forEach((stage, index) => {
      const weight = volumes[index] / volumeSum;
      const nodeHeight = Math.max(
        MIN_NODE_HEIGHT,
        usableHeight * Math.max(0.18, weight),
      );
      nodes[stage.name] = {
        name: stage.name,
        order: stage.order,
        x,
        y: cursorY + nodeHeight / 2,
        width: NODE_WIDTH,
        height: nodeHeight,
      };
      cursorY += nodeHeight + NODE_GAP_Y;
    });
  }

  const orderedFlows = [...flows]
    .filter((flow) => nodes[flow.source] && nodes[flow.destination])
    .sort((a, b) => {
      const sourceDelta =
        (nodes[a.source]?.order ?? 0) - (nodes[b.source]?.order ?? 0);
      if (sourceDelta !== 0) {
        return sourceDelta;
      }
      return b.volume - a.volume;
    });

  const outOffset: Record<string, number> = {};
  const inOffset: Record<string, number> = {};
  const outTotal: Record<string, number> = {};
  const inTotal: Record<string, number> = {};
  for (const flow of orderedFlows) {
    outTotal[flow.source] = (outTotal[flow.source] || 0) + flow.volume;
    inTotal[flow.destination] =
      (inTotal[flow.destination] || 0) + flow.volume;
  }

  const links: IFlowFieldLinkGeom[] = [];
  for (const flow of orderedFlows) {
    const source = nodes[flow.source];
    const destination = nodes[flow.destination];
    const sourceSpan = Math.max(12, source.height - COLUMN_INSET * 2);
    const destSpan = Math.max(12, destination.height - COLUMN_INSET * 2);
    const sourceTop = source.y - sourceSpan / 2;
    const destTop = destination.y - destSpan / 2;
    const outUsed = outOffset[flow.source] || 0;
    const inUsed = inOffset[flow.destination] || 0;
    const outFrac = flow.volume / (outTotal[flow.source] || flow.volume || 1);
    const inFrac =
      flow.volume / (inTotal[flow.destination] || flow.volume || 1);
    const y0Top = sourceTop + outUsed * sourceSpan;
    const y0Bot = y0Top + outFrac * sourceSpan;
    const y1Top = destTop + inUsed * destSpan;
    const y1Bot = y1Top + inFrac * destSpan;
    outOffset[flow.source] = outUsed + outFrac;
    inOffset[flow.destination] = inUsed + inFrac;

    links.push({
      flow,
      key: flowKey(flow),
      x0: source.x + source.width / 2,
      y0Top,
      y0Bot,
      x1: destination.x - destination.width / 2,
      y1Top,
      y1Bot,
      color: statusColor(flow.status),
    });
  }

  return { links, nodes };
}

/**
 * Draws one Flow Field Story frame (kept in sync with FlowFieldStreamlitHtmlHelper).
 * Column Sankey layout: stages share X by order, stacked by volume; streams are filled ribbons.
 */
export function drawFlowFieldFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: IFlowFieldPayload,
  hoveredFlowKey: string | null = null,
): void {
  const cfg = payload.visualConfig;
  const stages = payload.stages ?? [];
  const flows = payload.flows ?? [];
  const summary = payload.summary;
  const L = layout(width, height);

  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, L.w, L.h);

  if (stages.length === 0) {
    ctx.fillStyle = "rgba(148,163,184,.8)";
    ctx.textAlign = "center";
    ctx.fillText("No data", L.w / 2, L.h / 2);
    return;
  }

  const { links, nodes } = buildFlowFieldLinks(width, height, payload);

  for (const link of links) {
    drawRibbon(ctx, link, hoveredFlowKey === link.key);
  }

  const dropOffs = dropOffByStage(flows);
  const bottleneckName = summary.bottleneck_stage?.name;

  for (const node of Object.values(nodes)) {
    const isBottleneck = bottleneckName === node.name;
    const left = node.x - node.width / 2;
    const top = node.y - node.height / 2;

    ctx.beginPath();
    roundRectPath(ctx, left, top, node.width, node.height, 10);
    ctx.fillStyle = isBottleneck ? "rgba(251,191,36,.18)" : "rgba(15,23,42,.96)";
    ctx.fill();
    ctx.lineWidth = isBottleneck ? 2 : 1.25;
    ctx.strokeStyle = isBottleneck ? "#fbbf24" : "rgba(148,163,184,.55)";
    ctx.stroke();

    if (cfg.show_labels) {
      ctx.fillStyle = "rgba(226,246,255,.95)";
      ctx.font = "600 12px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.name.slice(0, 14), node.x, node.y - 6);

      const volume = nodeVolume(node.name, flows);
      ctx.fillStyle = "rgba(148,163,184,.9)";
      ctx.font = "10px system-ui,sans-serif";
      ctx.fillText(formatCompact(volume), node.x, node.y + 10);
    }

    if (cfg.show_drop_offs && (dropOffs[node.name] || 0) > 0) {
      const drop = dropOffs[node.name];
      const badgeY = top + node.height + 14;
      ctx.fillStyle = "rgba(248,113,113,.9)";
      ctx.font = "9px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`↓ ${formatCompact(drop)}`, node.x, badgeY);
    }
  }

  if (summary.largest_drop_off) {
    ctx.fillStyle = "rgba(226,246,255,.45)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      `Largest drop-off: ${summary.largest_drop_off.source} → ${summary.largest_drop_off.destination} (${formatCompact(summary.largest_drop_off.drop_off)})`,
      L.p.l,
      L.h - 10,
    );
  }
}
