import { catColor, hashStr, healthColor, riskColor, typeColor } from "./storyColorUtils";

export interface INetworkWebNode {
  id: string;
  label: string;
  category: string;
  degree: number;
  value?: number;
  health_score?: number;
  risk_score?: number;
  x?: number;
  y?: number;
  _r?: number;
}

export interface INetworkWebEdge {
  source: string;
  target: string;
  relationship_type: string;
  weight: number;
  edge_value?: number;
  frequency?: number;
  edge_risk_score?: number;
  edge_status?: string;
}

export interface INetworkWebVisualConfig {
  layout_algorithm: string;
  node_size_by: string;
  node_color_by: string;
  edge_width_by: string;
  edge_color_by: string;
  show_arrows: boolean;
  highlight_depth: number;
  min_weight_filter: number;
  max_nodes: number;
  max_edges: number;
}

export interface INetworkWebPayload {
  nodes: INetworkWebNode[];
  edges: INetworkWebEdge[];
  visualConfig: INetworkWebVisualConfig;
}

function nodeRadius(
  n: INetworkWebNode,
  nodes: INetworkWebNode[],
  cfg: INetworkWebVisualConfig,
): number {
  const mode = (cfg.node_size_by || "degree").toLowerCase();
  if (mode === "none") {
    return 5;
  }
  const pick = (x: INetworkWebNode): number =>
    mode === "value" ? (x.value ?? x.degree) : x.degree;
  const vals = nodes.map(pick);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const v = pick(n);
  if (!(hi > lo)) {
    return 6;
  }
  return 4 + Math.sqrt((v - lo) / (hi - lo)) * 8;
}

function edgeWidth(
  e: INetworkWebEdge,
  edges: INetworkWebEdge[],
  cfg: INetworkWebVisualConfig,
): number {
  const mode = (cfg.edge_width_by || "weight").toLowerCase();
  if (mode === "none") {
    return 1;
  }
  const pick = (x: INetworkWebEdge): number =>
    mode === "frequency"
      ? (x.frequency ?? 1)
      : mode === "value"
        ? (x.edge_value ?? x.weight)
        : x.weight;
  const vals = edges.map(pick);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const v = pick(e);
  if (!(hi > lo)) {
    return 1.2;
  }
  return 0.6 + ((v - lo) / (hi - lo)) * 2.5;
}

function nodeFill(
  n: INetworkWebNode,
  cfg: INetworkWebVisualConfig,
): string {
  const mode = (cfg.node_color_by || "category").toLowerCase();
  if (mode === "health_score" && n.health_score != null) {
    return healthColor(n.health_score);
  }
  if (mode === "risk_score" && n.risk_score != null) {
    return riskColor(n.risk_score);
  }
  return catColor(n.category || "Other");
}

function edgeStroke(
  e: INetworkWebEdge,
  cfg: INetworkWebVisualConfig,
): string {
  const mode = (cfg.edge_color_by || "relationship_type").toLowerCase();
  if (mode === "none") {
    return "rgba(148,163,184,.55)";
  }
  if (mode === "risk_score" && e.edge_risk_score != null) {
    return riskColor(e.edge_risk_score);
  }
  if (mode === "status") {
    return e.edge_status === "Watch" || e.edge_status === "Critical"
      ? "#f97316"
      : "#67e8f9";
  }
  return typeColor(e.relationship_type || "link");
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - len * Math.cos(angle - 0.4),
    y2 - len * Math.sin(angle - 0.4),
  );
  ctx.lineTo(
    x2 - len * Math.cos(angle + 0.4),
    y2 - len * Math.sin(angle + 0.4),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Draws a static network preview frame (force-ish layout, settled).
 */
export function drawNetworkWebFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  payload: INetworkWebPayload,
): void {
  const { nodes, edges, visualConfig: cfg } = payload;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);

  const pad = 20;
  const laid = nodes.map((n, i) => {
    const copy: INetworkWebNode = { ...n };
    if (cfg.layout_algorithm === "radial") {
      const ang = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const rad = Math.min(width, height) * 0.36;
      copy.x = width / 2 + Math.cos(ang) * rad;
      copy.y = height / 2 + Math.sin(ang) * rad;
    } else {
      const ang = ((hashStr(n.id) % 360) * Math.PI) / 180;
      const rad = 30 + (hashStr(n.id + "r") % 90);
      copy.x = width / 2 + Math.cos(ang) * rad * 0.85;
      copy.y = height / 2 + Math.sin(ang) * rad * 0.7;
    }
    copy._r = nodeRadius(copy, nodes, cfg);
    return copy;
  });

  // Light force settle for preview
  if (cfg.layout_algorithm !== "radial") {
    for (let iter = 0; iter < 40; iter++) {
      for (let i = 0; i < laid.length; i++) {
        for (let j = i + 1; j < laid.length; j++) {
          const a = laid[i];
          const b = laid[j];
          let dx = (a.x ?? 0) - (b.x ?? 0);
          let dy = (a.y ?? 0) - (b.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = 400 / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          a.x = (a.x ?? 0) + dx * 0.15;
          a.y = (a.y ?? 0) + dy * 0.15;
          b.x = (b.x ?? 0) - dx * 0.15;
          b.y = (b.y ?? 0) - dy * 0.15;
        }
      }
      for (const e of edges) {
        const a = laid.find((n) => n.id === e.source);
        const b = laid.find((n) => n.id === e.target);
        if (!a || !b) continue;
        let dx = (b.x ?? 0) - (a.x ?? 0);
        let dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 45) * 0.03;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.x = (a.x ?? 0) + dx;
        a.y = (a.y ?? 0) + dy;
        b.x = (b.x ?? 0) - dx;
        b.y = (b.y ?? 0) - dy;
      }
      for (const n of laid) {
        n.x = Math.max(pad + (n._r ?? 4), Math.min(width - pad - (n._r ?? 4), n.x ?? 0));
        n.y = Math.max(pad + (n._r ?? 4), Math.min(height - pad - (n._r ?? 4), n.y ?? 0));
      }
    }
  }

  for (const e of edges) {
    const a = laid.find((n) => n.id === e.source);
    const b = laid.find((n) => n.id === e.target);
    if (!a || !b) continue;
    const color = edgeStroke(e, cfg);
    const w = edgeWidth(e, edges, cfg);
    const ax = a.x ?? 0;
    const ay = a.y ?? 0;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (cfg.show_arrows) {
      drawArrow(ctx, ax, ay, bx, by, color);
    }
  }

  for (const n of laid) {
    const r = n._r ?? 5;
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
    ctx.fillStyle = nodeFill(n, cfg);
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
