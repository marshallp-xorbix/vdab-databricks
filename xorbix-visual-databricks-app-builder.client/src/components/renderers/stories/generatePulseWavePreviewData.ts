import type {
  IPulseWaveEvent,
  IPulseWavePayload,
  IPulseWaveRecord,
  IPulseWaveVisualConfig,
} from "./pulseWaveCanvasDraw";
import { createSeededRng } from "./seededRng";

function withAxisLabel(visualConfig: IPulseWaveVisualConfig): IPulseWaveVisualConfig {
  return {
    ...visualConfig,
    y_axis_label:
      visualConfig.y_axis_label || visualConfig.metric_name || "Metric",
  };
}

function buildSummary(records: IPulseWaveRecord[], eventCount: number) {
  let largestSpike: { time_period: string; delta: number } | null = null;
  let largestDrop: { time_period: string; delta: number } | null = null;
  for (let i = 1; i < records.length; i++) {
    const delta = records[i].metric_value - records[i - 1].metric_value;
    const point = { time_period: records[i].time_period, delta };
    if (!largestSpike || delta > largestSpike.delta) {
      largestSpike = point;
    }
    if (!largestDrop || delta < largestDrop.delta) {
      largestDrop = point;
    }
  }
  const warnings: string[] = [];
  if (records.length < 8) {
    warnings.push("Fewer than 8 time points — wave may be less meaningful.");
  }
  return {
    point_count: records.length,
    largest_spike: largestSpike,
    largest_drop: largestDrop,
    event_count: eventCount,
    warnings,
  };
}

/**
 * Builds deterministic weekly pulse-wave preview data with spike, drop, and events.
 */
export function generatePulseWavePreviewData(
  seedKey: string,
  visualConfig: IPulseWaveVisualConfig,
): IPulseWavePayload {
  const next = createSeededRng(seedKey);
  const records: IPulseWaveRecord[] = [];
  const events: IPulseWaveEvent[] = [];
  const start = new Date(Date.UTC(2026, 0, 6));

  for (let week = 0; week < 26; week++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * 7);
    const period = date.toISOString().slice(0, 10);
    let metric = 95000 + Math.sin(week / 3.2) * 8000 + next() * 6000;
    if (week === 6) {
      metric += 22000;
    }
    if (week === 14) {
      metric -= 28000;
    }
    if (week === 18) {
      metric += 12000;
    }
    const baseline = 100000 + Math.sin(week / 8) * 2500;
    records.push({
      time_period: period,
      metric_value: Math.round(metric),
      baseline_value: Math.round(baseline),
    });
  }

  events.push(
    {
      time_period: records[6].time_period,
      event_name: "Campaign launch",
      event_type: "positive",
      impact_score: 78,
    },
    {
      time_period: records[14].time_period,
      event_name: "Supply disruption",
      event_type: "negative",
      impact_score: 84,
    },
    {
      time_period: records[18].time_period,
      event_name: "Recovery push",
      event_type: "operational",
      impact_score: 55,
    },
  );

  return {
    records,
    events,
    visualConfig: withAxisLabel(visualConfig),
    summary: buildSummary(records, events.length),
  };
}
