import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const PROPERTY_NAMES = [
  "title", "entityId", "entityLabel", "category", "sizeMetric", "xMetric",
  "yMetric", "changeMetric", "timeField", "healthScore", "riskScore",
  "layoutMode", "sizeScale", "minRadiusPx", "maxRadiusPx", "colorBy",
  "pulseBy", "pulseThreshold", "pulseThresholdMode", "shapeVariation",
  "labelMode", "animationEnabled", "animationSpeed",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const MEASURE_TRANSFORMS = new Set(["none", "sum", "avg", "count", "count_distinct", "min", "max"]);
const TEMPORAL_TRANSFORMS = new Set(["count", "count_distinct", "min", "max"]);
const CATEGORICAL_TRANSFORMS = new Set(["count", "count_distinct"]);
const LAYOUT_MODES = new Set(["hybrid", "scatter", "cluster"]);
const SIZE_SCALES = new Set(["linear", "sqrt", "log"]);
const COLOR_MODES = new Set(["category", "health_score"]);
const PULSE_MODES = new Set(["risk_score", "none"]);
const PULSE_THRESHOLD_MODES = new Set(["above", "below"]);
const LABEL_MODES = new Set(["none", "compact", "full"]);

type ChartErrorFactory = () => Error;

/** Validated field mapping used by AmoebaStory SQL and canvas configuration. */
export interface AmoebaStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable and portable visual/data configuration for AmoebaStory. */
export interface AmoebaStoryProperties {
  title: string;
  entityId: AmoebaStoryAxis;
  entityLabel: AmoebaStoryAxis;
  category: AmoebaStoryAxis;
  sizeMetric: AmoebaStoryAxis;
  xMetric: AmoebaStoryAxis;
  yMetric: AmoebaStoryAxis;
  changeMetric: AmoebaStoryAxis;
  timeField: AmoebaStoryAxis;
  healthScore: AmoebaStoryAxis;
  riskScore: AmoebaStoryAxis;
  layoutMode: "hybrid" | "scatter" | "cluster";
  sizeScale: "linear" | "sqrt" | "log";
  minRadiusPx: number;
  maxRadiusPx: number;
  colorBy: "category" | "health_score";
  pulseBy: "risk_score" | "none";
  pulseThreshold: number;
  pulseThresholdMode: "above" | "below";
  shapeVariation: number;
  labelMode: "none" | "compact" | "full";
  animationEnabled: boolean;
  animationSpeed: number;
}

/** Validates Amoeba properties during component save and portable import. */
export function validateAmoebaStoryProperties(properties: ProjectJsonObject): void {
  readAmoebaStoryProperties(properties);
}

/** Parses Amoeba properties again at source generation using typed failures. */
export function readAmoebaStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ChartErrorFactory = invalidComponents,
): AmoebaStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory();
  }

  const entityId = readAxis(properties.entityId, "categorical", "none", new Set(["none"]), errorFactory);
  if (entityId.transform !== "none") {
    throw errorFactory();
  }
  const result: AmoebaStoryProperties = {
    title: readText(properties.title, "Amoeba Story", 500, errorFactory),
    entityId,
    entityLabel: readAxis(properties.entityLabel, "categorical", "none", MEASURE_TRANSFORMS, errorFactory),
    category: readAxis(properties.category, "categorical", "none", MEASURE_TRANSFORMS, errorFactory),
    sizeMetric: readAxis(properties.sizeMetric, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    xMetric: readAxis(properties.xMetric, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    yMetric: readAxis(properties.yMetric, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    changeMetric: readAxis(properties.changeMetric, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    timeField: readAxis(properties.timeField, "categorical", "none", new Set(["none"]), errorFactory),
    healthScore: readAxis(properties.healthScore, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    riskScore: readAxis(properties.riskScore, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    layoutMode: readEnum(properties.layoutMode, "hybrid", LAYOUT_MODES, errorFactory),
    sizeScale: readEnum(properties.sizeScale, "sqrt", SIZE_SCALES, errorFactory),
    minRadiusPx: readInteger(properties.minRadiusPx, 42, 8, 200, errorFactory),
    maxRadiusPx: readInteger(properties.maxRadiusPx, 130, 16, 300, errorFactory),
    colorBy: readEnum(properties.colorBy, "category", COLOR_MODES, errorFactory),
    pulseBy: readEnum(properties.pulseBy, "risk_score", PULSE_MODES, errorFactory),
    pulseThreshold: readNumber(properties.pulseThreshold, 50, 0, 100, errorFactory),
    pulseThresholdMode: readEnum(properties.pulseThresholdMode, "above", PULSE_THRESHOLD_MODES, errorFactory),
    shapeVariation: readNumber(properties.shapeVariation, 0.35, 0, 1, errorFactory),
    labelMode: readEnum(properties.labelMode, "compact", LABEL_MODES, errorFactory),
    animationEnabled: readBoolean(properties.animationEnabled, true, errorFactory),
    animationSpeed: readNumber(properties.animationSpeed, 1, 0.25, 3, errorFactory),
  };
  if (result.minRadiusPx > result.maxRadiusPx) {
    throw errorFactory();
  }
  return result;
}

/** Checks mapped fields and their types against selected workspace metadata. */
export function validateAmoebaStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ChartErrorFactory = invalidComponents,
): void {
  const resource = readUnityCatalogResource(bindings);
  if (resource === null || !Array.isArray(resource.columns) || resource.columns.length === 0) {
    return;
  }
  const columns = readColumns(resource.columns, errorFactory);
  const story = readAmoebaStoryProperties(properties, errorFactory);
  const dimensions = [story.entityId, story.entityLabel, story.category, story.timeField];
  const measures: AmoebaStoryAxis[] = [
    story.sizeMetric, story.xMetric, story.yMetric, story.changeMetric,
    story.healthScore, story.riskScore,
  ];
  for (const axis of dimensions) {
    validateMappedColumn(axis, columns, false, errorFactory);
  }
  for (const axis of measures) {
    validateMappedColumn(axis, columns, true, errorFactory);
  }
}

function readAxis(
  value: unknown,
  defaultScale: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ChartErrorFactory,
): AmoebaStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory();
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  const scaleType = value.scaleType ?? defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (
    (scaleType !== "categorical" && scaleType !== "continuous") ||
    scaleType !== defaultScale || typeof transform !== "string" || !transforms.has(transform)
  ) {
    throw errorFactory();
  }
  return { field, displayName, scaleType, transform };
}

function validateMappedColumn(
  axis: AmoebaStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  isMeasure: boolean,
  errorFactory: ChartErrorFactory,
): void {
  if (axis.field === "") {
    return;
  }
  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined) {
    throw errorFactory();
  }
  if (!isMeasure && axis.transform === "none") {
    return;
  }
  const transform = axis.transform === "none" ? "sum" : axis.transform;
  const type = classifyAmoebaColumnType(column.type);
  const allowed = type === "numeric"
    ? MEASURE_TRANSFORMS
    : type === "temporal"
      ? TEMPORAL_TRANSFORMS
      : CATEGORICAL_TRANSFORMS;
  if (type !== "unknown" && !allowed.has(transform)) {
    throw errorFactory();
  }
}

function classifyAmoebaColumnType(type: string | null): "numeric" | "temporal" | "categorical" | "unknown" {
  const normalized = (type ?? "").trim().toUpperCase();
  if (/^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|FLOAT|DOUBLE|DECIMAL|NUMERIC)(\b|\s*\()/.test(normalized)) {
    return "numeric";
  }
  if (/^(DATE|TIMESTAMP|TIMESTAMP_NTZ|TIME)(\b|\s*\()/.test(normalized)) {
    return "temporal";
  }
  if (/^(STRING|CHAR|VARCHAR|BOOLEAN|BOOL)(\b|\s*\()/.test(normalized)) {
    return "categorical";
  }
  return "unknown";
}

function readColumns(
  value: unknown[],
  errorFactory: ChartErrorFactory,
): Array<{ name: string; type: string | null }> {
  const columns = value.map((column) => {
    if (
      !isRecord(column) ||
      hasUnexpectedProperties(column, ["name", "type", "dataType", "nullable"]) ||
      (column.nullable !== undefined && typeof column.nullable !== "boolean")
    ) {
      throw errorFactory();
    }
    const name = readText(column.name, "", 255, errorFactory);
    const typeValue = column.type ?? column.dataType ?? null;
    if (typeValue !== null && (typeof typeValue !== "string" || typeValue.length > 255)) {
      throw errorFactory();
    }
    return { name, type: typeValue as string | null };
  });
  if (columns.some((column) => column.name === "") ||
      new Set(columns.map((column) => column.name)).size !== columns.length) {
    throw errorFactory();
  }
  return columns;
}

function readUnityCatalogResource(
  bindings: ProjectJsonObject | null,
): Record<string, unknown> | null {
  const binding = bindings?.unityCatalogTable;
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  return isRecord(resource) ? resource : null;
}

function readText(
  value: unknown,
  fallback: string,
  maximumLength: number,
  errorFactory: ChartErrorFactory,
): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || value.length > maximumLength ||
      value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw errorFactory();
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  fallback: T,
  values: Set<string>,
  errorFactory: ChartErrorFactory,
): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !values.has(value)) {
    throw errorFactory();
  }
  return value as T;
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  errorFactory: ChartErrorFactory,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw errorFactory();
  }
  return value as number;
}

function readNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  errorFactory: ChartErrorFactory,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw errorFactory();
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ChartErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory();
  }
  return value;
}
