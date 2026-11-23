import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  StoryFieldMappingsPanel,
  type IStoryFieldMappingRow,
} from "./StoryFieldMappingsPanel";

interface IAmoebaStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

const REQUIRED_FIELDS: IStoryFieldMappingRow[] = [
  { key: "entityId", label: "Entity ID", role: "amoeba-entity-id" },
  { key: "entityLabel", label: "Entity label", role: "amoeba-entity-label" },
  { key: "category", label: "Category", role: "amoeba-category" },
  {
    key: "sizeMetric",
    label: "Size metric",
    role: "amoeba-size",
    continuousDefault: true,
    defaultTransform: "sum",
  },
  {
    key: "xMetric",
    label: "X metric",
    role: "amoeba-x",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "yMetric",
    label: "Y metric",
    role: "amoeba-y",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "changeMetric",
    label: "Change metric",
    role: "amoeba-change",
    continuousDefault: true,
    defaultTransform: "avg",
  },
];

const OPTIONAL_FIELDS: IStoryFieldMappingRow[] = [
  { key: "timeField", label: "Time field (optional)", role: "amoeba-time" },
  {
    key: "healthScore",
    label: "Health score (optional)",
    role: "amoeba-health",
    continuousDefault: true,
    defaultTransform: "avg",
  },
  {
    key: "riskScore",
    label: "Risk score (optional)",
    role: "amoeba-risk",
    continuousDefault: true,
    defaultTransform: "avg",
  },
];

/**
 * Field role → column mappings for Amoeba Story. Rendered below Bindings.
 */
export const AmoebaStoryFieldMappingsPanel: FC<
  IAmoebaStoryFieldMappingsPanelProps
> = ({ component, onPropertyChange }) => (
  <StoryFieldMappingsPanel
    component={component}
    onPropertyChange={onPropertyChange}
    requiredFields={REQUIRED_FIELDS}
    optionalFields={OPTIONAL_FIELDS}
  />
);
