import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "xDimension", "yDimension", "heightMetric", "timeField", "terrainCategory",
  "riskScore", "targetValue", "baselineValue", "forecastValue", "volumeMetric", "status",
  "eventName", "eventDate", "calloutText", "terrainMode", "heightScale", "interpolation",
  "gridResolution", "colorBy", "showPeakLabels", "showValleyLabels", "cameraPreset", "aggregationMethod",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_TRANSFORMS = new Set(["none"]);
const MEASURE_TRANSFORMS = new Set(["none", "sum", "avg", "min", "max", "count", "count_distinct"]);
const DIMENSION_AXES = [
  "xDimension", "yDimension", "timeField", "terrainCategory", "status", "eventName", "eventDate", "calloutText",
] as const;
const MEASURE_AXES = ["heightMetric", "riskScore", "targetValue", "baselineValue", "forecastValue", "volumeMetric"] as const;
const AXIS_NAMES = [...DIMENSION_AXES, ...MEASURE_AXES] as const;
const MEASURE_DEFAULTS: Record<(typeof MEASURE_AXES)[number], "sum" | "avg"> = {
  heightMetric: "sum",
  riskScore: "avg",
  targetValue: "avg",
  baselineValue: "avg",
  forecastValue: "avg",
  volumeMetric: "sum",
};
const ENUMS = {
  terrainMode: ["surface", "heat_surface", "ridge"],
  interpolation: ["none", "bilinear"],
  colorBy: ["height_metric", "risk_score", "variance", "category"],
  cameraPreset: ["front", "angled", "top", "free"],
  aggregationMethod: ["sum", "avg", "max", "min"],
} as const;

type AxisName = (typeof AXIS_NAMES)[number];
type ErrorFactory = (detail: string) => Error;

/** A validated TerrainStory field mapping. */
export interface TerrainStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable TerrainStory mappings and visualization settings. */
export interface TerrainStoryProperties {
  title: string;
  xDimension: TerrainStoryAxis;
  yDimension: TerrainStoryAxis;
  heightMetric: TerrainStoryAxis;
  timeField: TerrainStoryAxis;
  terrainCategory: TerrainStoryAxis;
  riskScore: TerrainStoryAxis;
  targetValue: TerrainStoryAxis;
  baselineValue: TerrainStoryAxis;
  forecastValue: TerrainStoryAxis;
  volumeMetric: TerrainStoryAxis;
  status: TerrainStoryAxis;
  eventName: TerrainStoryAxis;
  eventDate: TerrainStoryAxis;
  calloutText: TerrainStoryAxis;
  terrainMode: string;
  heightScale: number;
  interpolation: string;
  gridResolution: number;
  colorBy: string;
  showPeakLabels: boolean;
  showValleyLabels: boolean;
  cameraPreset: string;
  aggregationMethod: string;
}

/** Validates TerrainStory properties at save and portable-import boundaries. */
export function validateTerrainStoryProperties(properties: ProjectJsonObject): void {
  readTerrainStoryProperties(properties);
}

/** Parses saved TerrainStory settings again before source generation. */
export function readTerrainStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): TerrainStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("TerrainStory contains an unsupported property.");
  }

  const axes = {} as Record<AxisName, TerrainStoryAxis>;
  for (const name of DIMENSION_AXES) {
    axes[name] = readAxis(properties[name], "categorical", "none", DIMENSION_TRANSFORMS, errorFactory);
  }
  for (const name of MEASURE_AXES) {
    axes[name] = readAxis(properties[name], "continuous", MEASURE_DEFAULTS[name], MEASURE_TRANSFORMS, errorFactory);
  }

  return {
    title: readText(properties.title, "Terrain Story", 500, errorFactory),
    ...axes,
    terrainMode: readEnum(properties.terrainMode, "surface", ENUMS.terrainMode, errorFactory),
    heightScale: readNumber(properties.heightScale, 1, 0.1, 5, false, errorFactory),
    interpolation: readEnum(properties.interpolation, "bilinear", ENUMS.interpolation, errorFactory),
    gridResolution: readNumber(properties.gridResolution, 60, 10, 120, true, errorFactory),
    colorBy: readEnum(properties.colorBy, "height_metric", ENUMS.colorBy, errorFactory),
    showPeakLabels: readBoolean(properties.showPeakLabels, true, errorFactory),
    showValleyLabels: readBoolean(properties.showValleyLabels, true, errorFactory),
    cameraPreset: readEnum(properties.cameraPreset, "angled", ENUMS.cameraPreset, errorFactory),
    aggregationMethod: readEnum(properties.aggregationMethod, "sum", ENUMS.aggregationMethod, errorFactory),
  };
}

/** Validates persisted field mappings against selected current-workspace table metadata. */
export function validateTerrainStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable" || binding.columns.length === 0) {
    return;
  }

  const story = readTerrainStoryProperties(properties, errorFactory);
  for (const name of AXIS_NAMES) {
    const axis = story[name];
    if (axis.field === "") {
      continue;
    }
    const column = binding.columns.find((candidate) => candidate.name === axis.field);
    if (column === undefined) {
      throw errorFactory("TerrainStory mapping references a column outside the selected table.");
    }
    if (MEASURE_AXES.includes(name as (typeof MEASURE_AXES)[number])) {
      validateMeasure(axis, MEASURE_DEFAULTS[name as (typeof MEASURE_AXES)[number]], column.type, errorFactory);
    }
  }
}

function validateMeasure(
  axis: TerrainStoryAxis,
  noneFallback: string,
  columnType: string | null,
  errorFactory: ErrorFactory,
): void {
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  const kind = classifyChartColumnType(columnType);
  const allowed = kind === "numeric"
    ? MEASURE_TRANSFORMS
    : kind === "unknown"
      ? null
      : new Set(["count", "count_distinct"]);
  if (allowed !== null && !allowed.has(transform)) {
    throw errorFactory("TerrainStory measure aggregation is incompatible with the mapped column type.");
  }
}

function readAxis(
  value: unknown,
  scaleType: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): TerrainStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("TerrainStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== scaleType) {
    throw errorFactory("TerrainStory field mapping has an incompatible scale.");
  }
  const transform = value.transform ?? defaultTransform;
  if (typeof transform !== "string" || !transforms.has(transform)) {
    throw errorFactory("TerrainStory field mapping has an unsupported aggregation.");
  }
  return { field, displayName, scaleType, transform };
}

function readEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[], errorFactory: ErrorFactory): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw errorFactory("TerrainStory contains an unsupported visualization setting.");
  }
  return value as T;
}

function readNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  integer: boolean,
  errorFactory: ErrorFactory,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw errorFactory("TerrainStory numeric visualization setting is out of range.");
  }
  return value;
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "string" || value.length > maximumLength || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw errorFactory("TerrainStory text is invalid.");
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("TerrainStory visual setting must be boolean.");
  }
  return value;
}
