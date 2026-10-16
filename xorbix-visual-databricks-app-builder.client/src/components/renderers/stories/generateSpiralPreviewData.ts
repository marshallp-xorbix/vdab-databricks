import type {
  ISpiralPayload,
  ISpiralRecord,
  ISpiralVisualConfig,
} from "./spiralCanvasDraw";

/**
 * Builds deterministic spiral preview data for a single progressive journey.
 */
export function generateSpiralPreviewData(
  _seedKey: string,
  visualConfig: ISpiralVisualConfig,
): ISpiralPayload {
  const records: ISpiralRecord[] = [
    {
      journey_name: "Expand APAC",
      stage: "Discovery",
      timeline: "2025-10-01",
      progress_pct: 100,
      metric_value: 120000,
      status: "complete",
      risk_score: 15,
      owner: "Jordan Lee",
      target_date: "2025-10-15",
      actual_date: "2025-10-12",
      schedule_variance_days: -3,
      key_achievement: "Market scan complete",
      cost: 45000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Partner Shortlist",
      timeline: "2025-11-15",
      progress_pct: 100,
      metric_value: 180000,
      status: "complete",
      risk_score: 28,
      owner: "Sam Patel",
      target_date: "2025-11-30",
      actual_date: "2025-12-05",
      schedule_variance_days: 5,
      key_achievement: "3 partners selected",
      cost: 62000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Pilot Launch",
      timeline: "2026-01-20",
      progress_pct: 85,
      metric_value: 420000,
      status: "delayed",
      risk_score: 62,
      owner: "Casey Nguyen",
      target_date: "2026-01-10",
      actual_date: "2026-01-28",
      schedule_variance_days: 18,
      key_achievement: "Soft launch in SG",
      cost: 210000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Regulatory Clearance",
      timeline: "2026-03-01",
      progress_pct: 40,
      metric_value: 95000,
      status: "blocked",
      risk_score: 78,
      owner: "Alex Rivera",
      target_date: "2026-02-28",
      actual_date: "2026-03-15",
      schedule_variance_days: 15,
      key_achievement: "Waiting on local counsel",
      cost: 88000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Scale Hiring",
      timeline: "2026-04-15",
      progress_pct: 55,
      metric_value: 310000,
      status: "active",
      risk_score: 48,
      owner: "Riley Brooks",
      target_date: "2026-04-30",
      actual_date: "2026-04-20",
      schedule_variance_days: -10,
      key_achievement: "12 of 20 roles filled",
      cost: 175000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Regional GTM",
      timeline: "2026-06-01",
      progress_pct: 20,
      metric_value: 680000,
      status: "active",
      risk_score: 55,
      owner: "Jordan Lee",
      target_date: "2026-06-30",
      key_achievement: "Campaign briefs drafted",
      cost: 320000,
    },
    {
      journey_name: "Expand APAC",
      stage: "Steady State",
      timeline: "2026-09-01",
      progress_pct: 0,
      metric_value: 900000,
      status: "not_started",
      risk_score: 35,
      owner: "Sam Patel",
      target_date: "2026-09-30",
      cost: 150000,
    },
  ];

  const highest = [...records].sort(
    (a, b) => b.metric_value - a.metric_value,
  )[0];

  return {
    records,
    journeys: ["Expand APAC"],
    selected_journey: "Expand APAC",
    visualConfig,
    summary: {
      journey_name: "Expand APAC",
      milestone_count: records.length,
      current_stage: "Regional GTM",
      avg_progress:
        records.reduce((sum, r) => sum + r.progress_pct, 0) / records.length,
      highest_value_milestone: highest
        ? { stage: highest.stage, metric_value: highest.metric_value }
        : null,
      delayed_count: records.filter(
        (r) =>
          r.status === "delayed" || (r.schedule_variance_days || 0) > 0,
      ).length,
      warnings: [],
    },
  };
}
