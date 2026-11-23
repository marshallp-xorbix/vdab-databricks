import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface ISpiralStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "journeyName", label: "Journey name", role: "spiral-journey" },
  { key: "stage", label: "Stage / milestone", role: "spiral-stage" },
  { key: "timelineField", label: "Timeline field", role: "spiral-timeline" },
  {
    key: "progressPct",
    label: "Progress %",
    role: "spiral-progress",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "metricValue",
    label: "Metric value",
    role: "spiral-metric",
    continuousDefault: true,
    defaultTransform: "sum",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  {
    key: "targetDate",
    label: "Target date (optional)",
    role: "spiral-target-date",
  },
  {
    key: "actualDate",
    label: "Actual date (optional)",
    role: "spiral-actual-date",
  },
  { key: "status", label: "Status (optional)", role: "spiral-status" },
  {
    key: "riskScore",
    label: "Risk score (optional)",
    role: "spiral-risk",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  { key: "owner", label: "Owner (optional)", role: "spiral-owner" },
  {
    key: "keyAchievement",
    label: "Key achievement (optional)",
    role: "spiral-achievement",
  },
  {
    key: "cost",
    label: "Cost (optional)",
    role: "spiral-cost",
    continuousDefault: true,
    defaultTransform: "sum",
  },
];

/**
 * Field role → column mappings for Spiral Story. Rendered below Bindings.
 */
export const SpiralStoryFieldMappingsPanel: FC<
  ISpiralStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
