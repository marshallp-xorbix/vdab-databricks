import type {
  IHoneycombPayload,
  IHoneycombRecord,
  IHoneycombVisualConfig,
} from "./honeycombCanvasDraw";

function classifyDeliveryHealth(rec: IHoneycombRecord): string {
  const status = String(rec.status || "")
    .trim()
    .toLowerCase();
  const prog = rec.progress_pct;
  let overdue = false;
  if (rec.due_date) {
    const dueTs = Date.parse(rec.due_date);
    if (!Number.isNaN(dueTs) && dueTs < Date.now() && prog < 100) {
      overdue = true;
    }
  }
  if (
    status === "critical" ||
    status === "blocked" ||
    status === "failed" ||
    (overdue && prog < 50)
  ) {
    return "behind";
  }
  if (
    status === "at risk" ||
    status === "at_risk" ||
    status === "watch" ||
    status === "delayed" ||
    overdue
  ) {
    return "at_risk";
  }
  return "on_track";
}

/**
 * Builds deterministic honeycomb preview data with category clusters and story beats.
 */
export function generateHoneycombPreviewData(
  _seedKey: string,
  visualConfig: IHoneycombVisualConfig,
): IHoneycombPayload {
  const baseRecords: IHoneycombRecord[] = [
    {
      item_name: "Expand APAC",
      impact_score: 88,
      priority_level: "High",
      progress_pct: 32,
      category: "Market",
      trend: "improving",
      risk_score: 55,
      owner: "Jordan Lee",
      status: "At Risk",
      notes: "Hiring delay",
    },
    {
      item_name: "Partner Portal",
      impact_score: 72,
      priority_level: "High",
      progress_pct: 61,
      category: "Market",
      trend: "stable",
      risk_score: 40,
      owner: "Sam Patel",
      status: "On Track",
    },
    {
      item_name: "Brand Refresh",
      impact_score: 48,
      priority_level: "Medium",
      progress_pct: 78,
      category: "Market",
      trend: "improving",
      risk_score: 22,
      owner: "Casey Nguyen",
      status: "On Track",
    },
    {
      item_name: "Cost Takeout",
      impact_score: 81,
      priority_level: "High",
      progress_pct: 45,
      category: "Financial",
      trend: "declining",
      risk_score: 68,
      owner: "Riley Brooks",
      status: "Watch",
    },
    {
      item_name: "Pricing Model",
      impact_score: 76,
      priority_level: "High",
      progress_pct: 28,
      category: "Financial",
      trend: "declining",
      risk_score: 74,
      owner: "Alex Rivera",
      status: "Critical",
    },
    {
      item_name: "Working Capital",
      impact_score: 54,
      priority_level: "Medium",
      progress_pct: 70,
      category: "Financial",
      trend: "improving",
      risk_score: 35,
      owner: "Jordan Lee",
      status: "On Track",
    },
    {
      item_name: "NPS Program",
      impact_score: 69,
      priority_level: "Medium",
      progress_pct: 55,
      category: "Customer",
      trend: "improving",
      risk_score: 30,
      owner: "Sam Patel",
      status: "On Track",
    },
    {
      item_name: "Support SLAs",
      impact_score: 63,
      priority_level: "High",
      progress_pct: 41,
      category: "Customer",
      trend: "stable",
      risk_score: 52,
      owner: "Casey Nguyen",
      status: "At Risk",
    },
    {
      item_name: "Self-Serve Help",
      impact_score: 58,
      priority_level: "Low",
      progress_pct: 82,
      category: "Customer",
      trend: "improving",
      risk_score: 18,
      owner: "Riley Brooks",
      status: "On Track",
    },
    {
      item_name: "Cloud Migration",
      impact_score: 91,
      priority_level: "High",
      progress_pct: 36,
      category: "Operations",
      trend: "declining",
      risk_score: 79,
      owner: "Alex Rivera",
      status: "Blocked",
    },
    {
      item_name: "Data Platform",
      impact_score: 84,
      priority_level: "High",
      progress_pct: 58,
      category: "Operations",
      trend: "improving",
      risk_score: 47,
      owner: "Jordan Lee",
      status: "On Track",
    },
    {
      item_name: "Automation Hub",
      impact_score: 66,
      priority_level: "Medium",
      progress_pct: 49,
      category: "Operations",
      trend: "stable",
      risk_score: 44,
      owner: "Sam Patel",
      status: "Watch",
    },
  ];

  const records = baseRecords.map((rec) => ({
    ...rec,
    delivery_health: classifyDeliveryHealth(rec),
  }));

  const hilp = records.filter(
    (r) => r.impact_score >= 70 && r.progress_pct < 40,
  );
  const highestRisk = [...records]
    .filter((r) => typeof r.risk_score === "number")
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0];

  const healthCounts = { on_track: 0, at_risk: 0, behind: 0 };
  for (const r of records) {
    const h = r.delivery_health;
    if (h === "on_track" || h === "at_risk" || h === "behind") {
      healthCounts[h] += 1;
    }
  }

  return {
    records,
    visualConfig,
    summary: {
      item_count: records.length,
      category_count: 4,
      avg_progress:
        records.reduce((sum, r) => sum + r.progress_pct, 0) / records.length,
      high_impact_low_progress: hilp.map((r) => ({
        item_name: r.item_name,
        impact_score: r.impact_score,
        progress_pct: r.progress_pct,
      })),
      highest_risk: highestRisk
        ? {
            item_name: highestRisk.item_name,
            risk_score: highestRisk.risk_score || 0,
          }
        : null,
      delivery_health: healthCounts,
      warnings: [],
    },
  };
}
