import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface IPulseWaveStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time period", role: "pulse-wave-time" },
  {
    key: "metricValue",
    label: "Metric value",
    role: "pulse-wave-metric",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "baselineValue",
    label: "Baseline / target",
    role: "pulse-wave-baseline",
    continuousDefault: true,
    defaultTransform: "avg",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  {
    key: "eventName",
    label: "Event name (optional)",
    role: "pulse-wave-event-name",
  },
  {
    key: "eventType",
    label: "Event type (optional)",
    role: "pulse-wave-event-type",
  },
  {
    key: "impactScore",
    label: "Impact score (optional)",
    role: "pulse-wave-impact",
    continuousDefault: true,
    defaultTransform: "avg",
  },
];

/**
 * Field role → column mappings for Pulse Wave Story. Rendered below Bindings.
 */
export const PulseWaveStoryFieldMappingsPanel: FC<
  IPulseWaveStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
