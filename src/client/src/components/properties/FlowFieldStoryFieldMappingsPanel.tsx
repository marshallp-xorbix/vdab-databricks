import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface IFlowFieldStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "sourceStage", label: "Source stage", role: "flow-field-source" },
  {
    key: "destinationStage",
    label: "Destination stage",
    role: "flow-field-destination",
  },
  {
    key: "flowVolume",
    label: "Flow volume",
    role: "flow-field-volume",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "stageOrder",
    label: "Stage order",
    role: "flow-field-stage-order",
    continuousDefault: true,
    defaultTransform: "max",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "flow-field-time" },
  {
    key: "conversionPct",
    label: "Conversion % (optional)",
    role: "flow-field-conversion",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "dropOffCount",
    label: "Drop-off count (optional)",
    role: "flow-field-drop-off",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "avgTimeInStage",
    label: "Avg time in stage (optional)",
    role: "flow-field-avg-time",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "status",
    label: "Status (optional)",
    role: "flow-field-status",
  },
];

/**
 * Field role → column mappings for Flow Field Story. Rendered below Bindings.
 */
export const FlowFieldStoryFieldMappingsPanel: FC<
  IFlowFieldStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
