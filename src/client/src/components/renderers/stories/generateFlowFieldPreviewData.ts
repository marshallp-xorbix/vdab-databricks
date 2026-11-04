import type {
  IFlowFieldFlow,
  IFlowFieldPayload,
  IFlowFieldStage,
  IFlowFieldVisualConfig,
} from "./flowFieldCanvasDraw";

/**
 * Builds deterministic funnel preview data with a clear bottleneck and drop-off.
 * Won/Lost share terminal order so they stack in one column (clean Sankey layout).
 */
export function generateFlowFieldPreviewData(
  _seedKey: string,
  visualConfig: IFlowFieldVisualConfig,
): IFlowFieldPayload {
  const stages: IFlowFieldStage[] = [
    { name: "Lead", order: 1 },
    { name: "Qualified", order: 2 },
    { name: "Proposal", order: 3 },
    { name: "Won", order: 4 },
    { name: "Lost", order: 4 },
  ];

  const flows: IFlowFieldFlow[] = [
    {
      source: "Lead",
      destination: "Qualified",
      volume: 1200,
      conversion_pct: 62.5,
      drop_off: 450,
      avg_time_in_stage: 2.4,
      status: "normal",
    },
    {
      source: "Qualified",
      destination: "Proposal",
      volume: 750,
      conversion_pct: 48,
      drop_off: 280,
      avg_time_in_stage: 5.1,
      status: "delayed",
    },
    {
      source: "Proposal",
      destination: "Won",
      volume: 360,
      conversion_pct: 72,
      drop_off: 90,
      avg_time_in_stage: 8.2,
      status: "normal",
    },
    {
      source: "Qualified",
      destination: "Lost",
      volume: 190,
      conversion_pct: 0,
      avg_time_in_stage: 3.0,
      status: "failed",
    },
    {
      source: "Proposal",
      destination: "Lost",
      volume: 140,
      conversion_pct: 0,
      avg_time_in_stage: 6.5,
      status: "failed",
    },
  ];

  return {
    stages,
    flows,
    visualConfig,
    summary: {
      stage_count: stages.length,
      flow_count: flows.length,
      total_volume: flows.reduce((sum, flow) => sum + flow.volume, 0),
      largest_drop_off: {
        source: "Lead",
        destination: "Qualified",
        drop_off: 450,
      },
      bottleneck_stage: { name: "Qualified", reason: "low_conversion" },
      warnings: [],
    },
  };
}
