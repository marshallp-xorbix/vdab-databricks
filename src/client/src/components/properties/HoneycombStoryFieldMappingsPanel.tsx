import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface IHoneycombStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "itemName", label: "Item name", role: "honeycomb-item-name" },
  {
    key: "impactScore",
    label: "Impact score",
    role: "honeycomb-impact",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "priorityLevel",
    label: "Priority level",
    role: "honeycomb-priority",
  },
  {
    key: "progressPct",
    label: "Progress %",
    role: "honeycomb-progress",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  { key: "category", label: "Category / pillar", role: "honeycomb-category" },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "honeycomb-time" },
  { key: "trend", label: "Trend (optional)", role: "honeycomb-trend" },
  {
    key: "riskScore",
    label: "Risk score (optional)",
    role: "honeycomb-risk",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  { key: "owner", label: "Owner (optional)", role: "honeycomb-owner" },
  { key: "dueDate", label: "Due date (optional)", role: "honeycomb-due-date" },
  {
    key: "investment",
    label: "Investment (optional)",
    role: "honeycomb-investment",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "benefitValue",
    label: "Benefit value (optional)",
    role: "honeycomb-benefit",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  { key: "notes", label: "Notes (optional)", role: "honeycomb-notes" },
  { key: "status", label: "Status (optional)", role: "honeycomb-status" },
];

/**
 * Field role → column mappings for Honeycomb Story. Rendered below Bindings.
 */
export const HoneycombStoryFieldMappingsPanel: FC<
  IHoneycombStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
