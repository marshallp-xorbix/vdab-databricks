import type {
  IHeatMapPayload,
  IHeatMapRecord,
  IHeatMapVisualConfig,
} from "./heatMapCanvasDraw";
import { createSeededRng } from "./seededRng";
import { USA_STATE_BOUNDARIES } from "./usaStateBoundaries";

/**
 * Builds deterministic mock USA state heat data for canvas preview.
 */
export function generateHeatMapPreviewData(
  seedKey: string,
  visualConfig: IHeatMapVisualConfig,
): IHeatMapPayload {
  const next = createSeededRng(seedKey);
  const records: IHeatMapRecord[] = [];

  for (const [code, state] of Object.entries(USA_STATE_BOUNDARIES)) {
    let metric = 8000 + next() * 120000;
    if (code === "CA" || code === "TX" || code === "NY") {
      metric = 140000 + next() * 40000;
    }
    if (code === "WY" || code === "VT" || code === "ND") {
      metric = 4000 + next() * 6000;
    }

    records.push({
      area_key: code,
      area_label: state.name,
      metric_value: Math.round(metric),
      change_pct: Math.round((-18 + next() * 36) * 10) / 10,
      secondary_value: Math.round(200 + next() * 4000),
      risk_score: Math.round(10 + next() * 70),
      category: code === "CA" || code === "WA" || code === "OR" ? "West" : "Core",
    });
  }

  const sorted = [...records].sort(
    (a, b) => b.metric_value - a.metric_value,
  );
  const withChange = [...records].sort(
    (a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0),
  );

  const warnings: string[] = [];

  return {
    records,
    visualConfig,
    summary: {
      matched_areas: records.length,
      unmatched_keys: [],
      highest: {
        area_key: sorted[0].area_key,
        metric_value: sorted[0].metric_value,
      },
      lowest: {
        area_key: sorted[sorted.length - 1].area_key,
        metric_value: sorted[sorted.length - 1].metric_value,
      },
      largest_positive_change: {
        area_key: withChange[0].area_key,
        change_pct: withChange[0].change_pct,
      },
      largest_negative_change: {
        area_key: withChange[withChange.length - 1].area_key,
        change_pct: withChange[withChange.length - 1].change_pct,
      },
      warnings,
    },
  };
}
