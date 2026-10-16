import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface IHeatMapStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "geographicArea", label: "Geographic area", role: "heat-map-area" },
  {
    key: "metricValue",
    label: "Metric value",
    role: "heat-map-metric",
    continuousDefault: true,
    defaultTransform: "sum",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "heat-map-time" },
  {
    key: "secondaryMetric",
    label: "Secondary metric (optional)",
    role: "heat-map-secondary",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "changePct",
    label: "Change % (optional)",
    role: "heat-map-change",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "targetValue",
    label: "Target value (optional)",
    role: "heat-map-target",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "riskScore",
    label: "Risk score (optional)",
    role: "heat-map-risk",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "category",
    label: "Category / segment (optional)",
    role: "heat-map-category",
  },
  {
    key: "forecastValue",
    label: "Forecast value (optional)",
    role: "heat-map-forecast",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  { key: "notes", label: "Notes (optional)", role: "heat-map-notes" },
];

/**
 * Field role → column mappings for Heat Map Story. Rendered below Bindings.
 */
export const HeatMapStoryFieldMappingsPanel: FC<
  IHeatMapStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
