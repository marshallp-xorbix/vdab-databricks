import type {
  INetworkWebEdge,
  INetworkWebNode,
  INetworkWebPayload,
  INetworkWebVisualConfig,
} from "./networkWebCanvasDraw";
import { createSeededRng } from "./seededRng";

const CATEGORIES = [
  "Supplier",
  "Plant",
  "Warehouse",
  "Retailer",
  "Owner",
  "System",
];
const REL_TYPES = ["supplies", "ships_to", "owns", "depends_on"];

/**
 * Builds deterministic mock network data for canvas preview (≥50 nodes / ≥100 edges).
 */
export function generateNetworkWebPreviewData(
  seedKey: string,
  visualConfig: INetworkWebVisualConfig,
): INetworkWebPayload {
  const next = createSeededRng(seedKey);

  const nodes: INetworkWebNode[] = [];
  for (let i = 0; i < 56; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    nodes.push({
      id: `n-${i + 1}`,
      label: `${category} ${i + 1}`,
      category,
      degree: 0,
      value: 50_000 + next() * 900_000,
      health_score: 40 + next() * 60,
      risk_score: next() * 100,
    });
  }

  const edges: INetworkWebEdge[] = [];
  const edgeKeys = new Set<string>();
  let attempts = 0;
  while (edges.length < 110 && attempts < 800) {
    attempts += 1;
    const si = Math.floor(next() * nodes.length);
    let ti = Math.floor(next() * nodes.length);
    if (ti === si) {
      ti = (ti + 1) % nodes.length;
    }
    const rtype = REL_TYPES[Math.floor(next() * REL_TYPES.length)];
    const key = `${nodes[si].id}|${nodes[ti].id}|${rtype}`;
    if (edgeKeys.has(key)) {
      continue;
    }
    edgeKeys.add(key);
    edges.push({
      source: nodes[si].id,
      target: nodes[ti].id,
      relationship_type: rtype,
      weight: 10 + next() * 200_000,
      edge_value: 10 + next() * 150_000,
      frequency: 1 + Math.floor(next() * 12),
      edge_risk_score: next() * 100,
      edge_status: next() > 0.85 ? "Watch" : "Active",
    });
  }

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) {
    n.degree = degree.get(n.id) ?? 0;
  }

  return { nodes, edges, visualConfig };
}
