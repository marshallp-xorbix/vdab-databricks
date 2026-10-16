import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface ITerrainStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "xDimension", label: "X dimension", role: "terrain-x" },
  { key: "yDimension", label: "Y dimension", role: "terrain-y" },
  {
    key: "heightMetric",
    label: "Height metric",
    role: "terrain-height",
    continuousDefault: true,
    defaultTransform: "sum",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "terrain-time" },
  {
    key: "terrainCategory",
    label: "Terrain category (optional)",
    role: "terrain-category",
  },
  {
    key: "riskScore",
    label: "Risk score (optional)",
    role: "terrain-risk",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "targetValue",
    label: "Target value (optional)",
    role: "terrain-target",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "baselineValue",
    label: "Baseline value (optional)",
    role: "terrain-baseline",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "forecastValue",
    label: "Forecast value (optional)",
    role: "terrain-forecast",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "volumeMetric",
    label: "Volume metric (optional)",
    role: "terrain-volume",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  { key: "status", label: "Status (optional)", role: "terrain-status" },
  {
    key: "eventName",
    label: "Event name (optional)",
    role: "terrain-event-name",
  },
  {
    key: "eventDate",
    label: "Event date (optional)",
    role: "terrain-event-date",
  },
  {
    key: "calloutText",
    label: "Callout text (optional)",
    role: "terrain-callout",
  },
];

/**
 * Field role → column mappings for Terrain Story. Rendered below Bindings.
 */
export const TerrainStoryFieldMappingsPanel: FC<
  ITerrainStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
