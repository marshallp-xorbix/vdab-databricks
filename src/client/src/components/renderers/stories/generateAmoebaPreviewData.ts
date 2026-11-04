import type {
  IAmoebaPayload,
  IAmoebaRecord,
  IAmoebaVisualConfig,
} from "./amoebaCanvasDraw";
import { createSeededRng } from "./seededRng";

const CATEGORIES = ["Enterprise", "Mid-Market", "SMB", "Partner", "Internal"];

/**
 * Builds deterministic mock amoeba records for canvas preview (≥25 entities).
 */
export function generateAmoebaPreviewData(
  seedKey: string,
  visualConfig: IAmoebaVisualConfig,
): IAmoebaPayload {
  const next = createSeededRng(seedKey);

  const records: IAmoebaRecord[] = [];
  for (let i = 0; i < 28; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const size = 50_000 + next() * 2_400_000;
    const growth = -18 + next() * 40;
    records.push({
      entity_id: `e-${i + 1}`,
      entity_label: `Entity ${i + 1}`,
      category,
      size_value: size,
      x_value: -10 + next() * 40,
      y_value: 20 + next() * 80,
      change_value: growth,
      health_score: 40 + next() * 60,
      risk_score: next() * 100,
    });
  }

  return { records, visualConfig };
}
