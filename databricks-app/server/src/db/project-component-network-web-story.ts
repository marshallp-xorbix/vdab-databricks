import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "sourceEntityId", "sourceEntityLabel", "targetEntityId", "targetEntityLabel",
  "relationshipType", "relationshipWeight", "timeField", "direction", "edgeValue",
  "frequency", "edgeRiskScore", "edgeStatus", "sourceCategory", "targetCategory",
  "sourceValue", "targetValue", "sourceHealthScore", "targetHealthScore", "sourceRiskScore",
  "targetRiskScore", "layoutAlgorithm", "nodeSizeBy", "nodeColorBy", "edgeWidthBy",
  "edgeColorBy", "showArrows", "highlightDepth", "minWeightFilter", "maxNodes", "maxEdges",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_AXES = [
  "sourceEntityId", "sourceEntityLabel", "targetEntityId", "targetEntityLabel",
  "relationshipType", "timeField", "direction", "edgeStatus", "sourceCategory", "targetCategory",
] as const;
const MEASURE_AXES = [
  "relationshipWeight", "edgeValue", "frequency", "edgeRiskScore", "sourceValue", "targetValue",
  "sourceHealthScore", "targetHealthScore", "sourceRiskScore", "targetRiskScore",
] as const;
const MEASURE_AXIS_NAMES = new Set<string>(MEASURE_AXES);
const AXIS_NAMES = [...DIMENSION_AXES, ...MEASURE_AXES] as const;

type NetworkWebAxisName = (typeof AXIS_NAMES)[number];
type ErrorFactory = (detail: string) => Error;

/** Validated NetworkWebStory field mapping. */
export interface NetworkWebStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: "none";
}

/** Saveable NetworkWebStory mappings and visualization settings. */
export interface NetworkWebStoryProperties {
  title: string;
  sourceEntityId: NetworkWebStoryAxis;
  sourceEntityLabel: NetworkWebStoryAxis;
  targetEntityId: NetworkWebStoryAxis;
  targetEntityLabel: NetworkWebStoryAxis;
  relationshipType: NetworkWebStoryAxis;
  relationshipWeight: NetworkWebStoryAxis;
  timeField: NetworkWebStoryAxis;
  direction: NetworkWebStoryAxis;
  edgeValue: NetworkWebStoryAxis;
  frequency: NetworkWebStoryAxis;
  edgeRiskScore: NetworkWebStoryAxis;
  edgeStatus: NetworkWebStoryAxis;
  sourceCategory: NetworkWebStoryAxis;
  targetCategory: NetworkWebStoryAxis;
  sourceValue: NetworkWebStoryAxis;
  targetValue: NetworkWebStoryAxis;
  sourceHealthScore: NetworkWebStoryAxis;
  targetHealthScore: NetworkWebStoryAxis;
  sourceRiskScore: NetworkWebStoryAxis;
  targetRiskScore: NetworkWebStoryAxis;
  layoutAlgorithm: "force" | "radial";
  nodeSizeBy: "degree" | "value" | "none";
  nodeColorBy: "category" | "health_score" | "risk_score";
  edgeWidthBy: "weight" | "value" | "frequency" | "none";
  edgeColorBy: "relationship_type" | "risk_score" | "status" | "none";
  showArrows: boolean;
  highlightDepth: number;
  minWeightFilter: number;
  maxNodes: number;
  maxEdges: number;
}

/** Validates NetworkWebStory settings at the component save and import boundary. */
export function validateNetworkWebStoryProperties(properties: ProjectJsonObject): void {
  readNetworkWebStoryProperties(properties);
}

/** Parses persisted settings again before source generation. */
export function readNetworkWebStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): NetworkWebStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("NetworkWebStory contains an unsupported property.");
  }

  const axes = {} as Record<NetworkWebAxisName, NetworkWebStoryAxis>;
  for (const name of DIMENSION_AXES) {
    axes[name] = readAxis(properties[name], "categorical", errorFactory);
  }
  for (const name of MEASURE_AXES) {
    axes[name] = readAxis(properties[name], "continuous", errorFactory);
  }

  return {
    title: readText(properties.title, "Network Web Story", 500, errorFactory),
    ...axes,
    layoutAlgorithm: readEnum(properties.layoutAlgorithm, "force", ["force", "radial"], errorFactory),
    nodeSizeBy: readEnum(properties.nodeSizeBy, "degree", ["degree", "value", "none"], errorFactory),
    nodeColorBy: readEnum(properties.nodeColorBy, "category", ["category", "health_score", "risk_score"], errorFactory),
    edgeWidthBy: readEnum(properties.edgeWidthBy, "weight", ["weight", "value", "frequency", "none"], errorFactory),
    edgeColorBy: readEnum(properties.edgeColorBy, "relationship_type", ["relationship_type", "risk_score", "status", "none"], errorFactory),
    showArrows: readBoolean(properties.showArrows, true, errorFactory),
    highlightDepth: readInteger(properties.highlightDepth, 1, 1, 3, errorFactory),
    minWeightFilter: readNonNegativeNumber(properties.minWeightFilter, 0, errorFactory),
    maxNodes: readInteger(properties.maxNodes, 300, 10, 500, errorFactory),
    maxEdges: readInteger(properties.maxEdges, 800, 10, 2_000, errorFactory),
  };
}

/** Validates mapped columns against metadata returned by the selected table. */
export function validateNetworkWebStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable") {
    return;
  }

  const story = readNetworkWebStoryProperties(properties, errorFactory);
  for (const name of AXIS_NAMES) {
    const axis = story[name];
    if (axis.field === "") {
      continue;
    }
    const column = binding.columns.find((candidate) => candidate.name === axis.field);
    if (column === undefined) {
      throw errorFactory("NetworkWebStory mapping references a column outside the selected table.");
    }
    if (MEASURE_AXIS_NAMES.has(name) && classifyChartColumnType(column.type) !== "numeric") {
      throw errorFactory("NetworkWebStory numeric mappings require numeric table columns.");
    }
  }
}

function readAxis(
  value: unknown,
  scaleType: "categorical" | "continuous",
  errorFactory: ErrorFactory,
): NetworkWebStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType, transform: "none" };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("NetworkWebStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== scaleType) {
    throw errorFactory("NetworkWebStory field mapping has an incompatible scale.");
  }
  if (value.transform !== undefined && value.transform !== null && value.transform !== "none") {
    throw errorFactory("NetworkWebStory does not support field aggregation transforms.");
  }
  return { field, displayName, scaleType, transform: "none" };
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "string" || value.length > maximumLength || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw errorFactory("NetworkWebStory text is invalid.");
  }
  return value;
}

function readEnum<const TValue extends string>(
  value: unknown,
  fallback: TValue,
  allowed: readonly TValue[],
  errorFactory: ErrorFactory,
): TValue {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value as TValue)) {
    throw errorFactory("NetworkWebStory visualization setting is unsupported.");
  }
  return value as TValue;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("NetworkWebStory visualization setting must be boolean.");
  }
  return value;
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  errorFactory: ErrorFactory,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw errorFactory("NetworkWebStory numeric setting is outside its supported range.");
  }
  return value;
}

function readNonNegativeNumber(value: unknown, fallback: number, errorFactory: ErrorFactory): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw errorFactory("NetworkWebStory minimum weight must be a finite non-negative number.");
  }
  return value;
}
