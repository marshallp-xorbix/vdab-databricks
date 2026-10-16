import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface INetworkWebStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "sourceEntityId", label: "Source entity ID", role: "network-source-id" },
  {
    key: "sourceEntityLabel",
    label: "Source entity label",
    role: "network-source-label",
  },
  { key: "targetEntityId", label: "Target entity ID", role: "network-target-id" },
  {
    key: "targetEntityLabel",
    label: "Target entity label",
    role: "network-target-label",
  },
  {
    key: "relationshipType",
    label: "Relationship type",
    role: "network-relationship-type",
  },
  {
    key: "relationshipWeight",
    label: "Relationship weight",
    role: "network-relationship-weight",
    continuousDefault: true,
    defaultTransform: "none",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "network-time" },
  { key: "direction", label: "Direction (optional)", role: "network-direction" },
  {
    key: "edgeValue",
    label: "Edge value (optional)",
    role: "network-edge-value",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "frequency",
    label: "Frequency (optional)",
    role: "network-frequency",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "edgeRiskScore",
    label: "Edge risk score (optional)",
    role: "network-edge-risk",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "edgeStatus",
    label: "Edge status (optional)",
    role: "network-edge-status",
  },
  {
    key: "sourceCategory",
    label: "Source category (optional)",
    role: "network-source-category",
  },
  {
    key: "targetCategory",
    label: "Target category (optional)",
    role: "network-target-category",
  },
  {
    key: "sourceValue",
    label: "Source value (optional)",
    role: "network-source-value",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "targetValue",
    label: "Target value (optional)",
    role: "network-target-value",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "sourceHealthScore",
    label: "Source health (optional)",
    role: "network-source-health",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "targetHealthScore",
    label: "Target health (optional)",
    role: "network-target-health",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "sourceRiskScore",
    label: "Source risk (optional)",
    role: "network-source-risk",
    continuousDefault: true,
    defaultTransform: "none",
  },
  {
    key: "targetRiskScore",
    label: "Target risk (optional)",
    role: "network-target-risk",
    continuousDefault: true,
    defaultTransform: "none",
  },
];

/**
 * Field role → column mappings for Network Web Story. Rendered below Bindings.
 */
export const NetworkWebStoryFieldMappingsPanel: FC<
  INetworkWebStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
