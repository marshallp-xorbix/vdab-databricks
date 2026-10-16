import type {
  ITerrainPayload,
  ITerrainRecord,
  ITerrainVisualConfig,
} from "./terrainCanvasDraw";
import { createSeededRng } from "./seededRng";

const X_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const Y_LABELS = [
  "Drivetrain",
  "Chassis",
  "Interior",
  "Thermal",
  "Sensors",
  "Power",
];

/**
 * Builds deterministic mock terrain grid for canvas preview.
 */
export function generateTerrainPreviewData(
  seedKey: string,
  visualConfig: ITerrainVisualConfig,
): ITerrainPayload {
  const next = createSeededRng(seedKey);

  const records: ITerrainRecord[] = [];
  for (let yi = 0; yi < Y_LABELS.length; yi++) {
    for (let xi = 0; xi < X_LABELS.length; xi++) {
      let height = 2000 + next() * 4000;
      if (xi === 2 && yi === 0) height = 7800;
      if (xi === 4 && yi === 3) height = 900;
      if (xi === 1 && yi === 5) height = 7200;
      if (xi === 5 && yi === 2) height = 1100;
      records.push({
        x: X_LABELS[xi],
        y: Y_LABELS[yi],
        height,
        category: yi % 2 === 0 ? "Core" : "Growth",
        risk_score: 10 + next() * 80,
        target_value: 4000,
        variance: height - 4000,
        status: height < 1500 ? "Critical" : height < 2500 ? "Warning" : "Normal",
      });
    }
  }

  const sorted = [...records].sort((a, b) => b.height - a.height);
  const peaks = sorted.slice(0, 3).map((r) => ({
    x: r.x,
    y: r.y,
    height: r.height,
  }));
  const valleys = [...records]
    .sort((a, b) => a.height - b.height)
    .slice(0, 3)
    .map((r) => ({ x: r.x, y: r.y, height: r.height }));

  return {
    records,
    callouts: [
      {
        x: peaks[0]?.x ?? "Jan",
        y: peaks[0]?.y ?? "Drivetrain",
        label: "Peak output",
        metric_value: peaks[0]?.height ?? 0,
      },
    ],
    visualConfig,
    summary: { top_peaks: peaks, bottom_valleys: valleys },
  };
}
