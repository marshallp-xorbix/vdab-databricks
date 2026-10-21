import type { ProjectJsonObject } from "../models/ProjectComponents";

export type NetworkWebStoryAxisName =
  | "sourceEntityId" | "sourceEntityLabel" | "targetEntityId" | "targetEntityLabel"
  | "relationshipType" | "relationshipWeight" | "timeField" | "direction" | "edgeValue"
  | "frequency" | "edgeRiskScore" | "edgeStatus" | "sourceCategory" | "targetCategory"
  | "sourceValue" | "targetValue" | "sourceHealthScore" | "targetHealthScore"
  | "sourceRiskScore" | "targetRiskScore";

export interface NetworkWebStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: "none";
}

export interface NetworkWebStoryAxisDefinition {
  name: NetworkWebStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
}

const CATEGORICAL_FIELDS = [
  { name: "sourceEntityId", label: "Source entity ID", required: true },
  { name: "sourceEntityLabel", label: "Source entity label", required: true },
  { name: "targetEntityId", label: "Target entity ID", required: true },
  { name: "targetEntityLabel", label: "Target entity label", required: true },
  { name: "relationshipType", label: "Relationship type", required: true },
  { name: "timeField", label: "Time field", required: false },
  { name: "direction", label: "Direction", required: false },
  { name: "edgeStatus", label: "Edge status", required: false },
  { name: "sourceCategory", label: "Source category", required: false },
  { name: "targetCategory", label: "Target category", required: false },
] as const;

const NUMERIC_FIELDS = [
  { name: "relationshipWeight", label: "Relationship weight", required: true },
  { name: "edgeValue", label: "Edge value", required: false },
  { name: "frequency", label: "Frequency", required: false },
  { name: "edgeRiskScore", label: "Edge risk score", required: false },
  { name: "sourceValue", label: "Source value", required: false },
  { name: "targetValue", label: "Target value", required: false },
  { name: "sourceHealthScore", label: "Source health score", required: false },
  { name: "targetHealthScore", label: "Target health score", required: false },
  { name: "sourceRiskScore", label: "Source risk score", required: false },
  { name: "targetRiskScore", label: "Target risk score", required: false },
] as const;

/** Legacy NetworkWebStory role names and their supported input kinds. */
export const NETWORK_WEB_STORY_AXES: readonly NetworkWebStoryAxisDefinition[] = [
  ...CATEGORICAL_FIELDS.map((field) => ({ ...field, scaleType: "categorical" as const })),
  ...NUMERIC_FIELDS.map((field) => ({ ...field, scaleType: "continuous" as const })),
];

/** Returns a safe axis view while preserving the selected table column. */
export function readNetworkWebStoryAxis(value: unknown, definition: NetworkWebStoryAxisDefinition): NetworkWebStoryAxisConfiguration {
  const axis = isRecord(value) ? value : {};
  return {
    field: typeof axis.field === "string" ? axis.field : "",
    displayName: typeof axis.displayName === "string" ? axis.displayName : "",
    scaleType: definition.scaleType,
    transform: "none",
  };
}

/** Creates canonical editor defaults for a new NetworkWebStory. */
export function createNetworkWebStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of NETWORK_WEB_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: "none",
    };
  }
  return {
    title: "Network Web Story",
    ...axes,
    layoutAlgorithm: "force",
    nodeSizeBy: "degree",
    nodeColorBy: "category",
    edgeWidthBy: "weight",
    edgeColorBy: "relationship_type",
    showArrows: true,
    highlightDepth: 1,
    minWeightFilter: 0,
    maxNodes: 300,
    maxEdges: 800,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
