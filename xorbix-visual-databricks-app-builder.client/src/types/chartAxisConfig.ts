export type ChartScaleType = "continuous" | "categorical";

export type ChartFieldTransform =
  | "none"
  | "sum"
  | "avg"
  | "count"
  | "count_distinct"
  | "min"
  | "max"
  | "yearly"
  | "monthly"
  | "weekly"
  | "daily";

export interface ChartAxisConfig {
  field: string;
  displayName: string;
  scaleType: ChartScaleType;
  transform: ChartFieldTransform;
}

const TRANSFORMS: ChartFieldTransform[] = [
  "none",
  "sum",
  "avg",
  "count",
  "count_distinct",
  "min",
  "max",
  "yearly",
  "monthly",
  "weekly",
  "daily",
];

export function normalizeChartTransform(v: unknown): ChartFieldTransform {
  const s = typeof v === "string" ? v.toLowerCase() : "none";
  return TRANSFORMS.includes(s as ChartFieldTransform)
    ? (s as ChartFieldTransform)
    : "none";
}

export function defaultChartAxis(
  overrides?: Partial<ChartAxisConfig>,
): ChartAxisConfig {
  return {
    field: "",
    displayName: "",
    scaleType: "categorical",
    transform: "none",
    ...overrides,
  };
}

/** Parse API JSON (camelCase) into a normalized axis config. */
export function parseChartAxis(raw: unknown): ChartAxisConfig {
  if (!raw || typeof raw !== "object") {
    return defaultChartAxis();
  }
  const o = raw as Record<string, unknown>;
  return {
    field: typeof o.field === "string" ? o.field : "",
    displayName: typeof o.displayName === "string" ? o.displayName : "",
    scaleType: o.scaleType === "continuous" ? "continuous" : "categorical",
    transform: normalizeChartTransform(o.transform),
  };
}

export type ChartAxisFieldRole =
  | "bar-x"
  | "bar-y"
  | "line-x"
  | "line-y"
  | "pie-category"
  | "pie-value"
  | "amoeba-entity-id"
  | "amoeba-entity-label"
  | "amoeba-category"
  | "amoeba-size"
  | "amoeba-x"
  | "amoeba-y"
  | "amoeba-change"
  | "amoeba-time"
  | "amoeba-health"
  | "amoeba-risk"
  | "network-source-id"
  | "network-source-label"
  | "network-target-id"
  | "network-target-label"
  | "network-relationship-type"
  | "network-relationship-weight"
  | "network-time"
  | "network-direction"
  | "network-edge-value"
  | "network-frequency"
  | "network-edge-risk"
  | "network-edge-status"
  | "network-source-category"
  | "network-target-category"
  | "network-source-value"
  | "network-target-value"
  | "network-source-health"
  | "network-target-health"
  | "network-source-risk"
  | "network-target-risk"
  | "terrain-x"
  | "terrain-y"
  | "terrain-height"
  | "terrain-time"
  | "terrain-category"
  | "terrain-risk"
  | "terrain-target"
  | "terrain-baseline"
  | "terrain-forecast"
  | "terrain-volume"
  | "terrain-status"
  | "terrain-event-name"
  | "terrain-event-date"
  | "terrain-callout"
  | "heat-map-area"
  | "heat-map-metric"
  | "heat-map-time"
  | "heat-map-secondary"
  | "heat-map-change"
  | "heat-map-target"
  | "heat-map-risk"
  | "heat-map-category"
  | "heat-map-forecast"
  | "heat-map-notes"
  | "pulse-wave-time"
  | "pulse-wave-metric"
  | "pulse-wave-baseline"
  | "pulse-wave-event-name"
  | "pulse-wave-event-type"
  | "pulse-wave-impact"
  | "flow-field-source"
  | "flow-field-destination"
  | "flow-field-volume"
  | "flow-field-stage-order"
  | "flow-field-time"
  | "flow-field-conversion"
  | "flow-field-drop-off"
  | "flow-field-avg-time"
  | "flow-field-status"
  | "honeycomb-item-name"
  | "honeycomb-impact"
  | "honeycomb-priority"
  | "honeycomb-progress"
  | "honeycomb-category"
  | "honeycomb-time"
  | "honeycomb-trend"
  | "honeycomb-risk"
  | "honeycomb-owner"
  | "honeycomb-due-date"
  | "honeycomb-investment"
  | "honeycomb-benefit"
  | "honeycomb-notes"
  | "honeycomb-status"
  | "spiral-journey"
  | "spiral-stage"
  | "spiral-timeline"
  | "spiral-progress"
  | "spiral-metric"
  | "spiral-target-date"
  | "spiral-actual-date"
  | "spiral-status"
  | "spiral-risk"
  | "spiral-owner"
  | "spiral-achievement"
  | "spiral-cost";

export function getTransformsForRole(role: ChartAxisFieldRole): ChartFieldTransform[] {
  switch (role) {
    case "bar-x":
    case "pie-category":
    case "amoeba-entity-id":
    case "amoeba-entity-label":
    case "amoeba-category":
    case "amoeba-time":
    case "network-source-id":
    case "network-source-label":
    case "network-target-id":
    case "network-target-label":
    case "network-relationship-type":
    case "network-time":
    case "network-direction":
    case "network-edge-status":
    case "network-source-category":
    case "network-target-category":
    case "terrain-x":
    case "terrain-y":
    case "terrain-time":
    case "terrain-category":
    case "terrain-status":
    case "terrain-event-name":
    case "terrain-event-date":
    case "terrain-callout":
    case "heat-map-area":
    case "heat-map-time":
    case "heat-map-category":
    case "heat-map-notes":
    case "pulse-wave-time":
    case "pulse-wave-event-name":
    case "pulse-wave-event-type":
    case "flow-field-source":
    case "flow-field-destination":
    case "flow-field-time":
    case "flow-field-status":
    case "honeycomb-item-name":
    case "honeycomb-priority":
    case "honeycomb-category":
    case "honeycomb-time":
    case "honeycomb-trend":
    case "honeycomb-owner":
    case "honeycomb-due-date":
    case "honeycomb-notes":
    case "honeycomb-status":
    case "spiral-journey":
    case "spiral-stage":
    case "spiral-timeline":
    case "spiral-target-date":
    case "spiral-actual-date":
    case "spiral-status":
    case "spiral-owner":
    case "spiral-achievement":
      return ["none"];
    case "bar-y":
      return ["none", "sum", "avg", "count", "count_distinct", "min", "max"];
    case "line-x":
      return ["none"];
    case "line-y":
      return ["none", "sum", "avg", "count", "count_distinct", "min", "max"];
    case "pie-value":
    case "amoeba-size":
    case "amoeba-x":
    case "amoeba-y":
    case "amoeba-change":
    case "amoeba-health":
    case "amoeba-risk":
    case "network-relationship-weight":
    case "network-edge-value":
    case "network-frequency":
    case "network-edge-risk":
    case "network-source-value":
    case "network-target-value":
    case "network-source-health":
    case "network-target-health":
    case "network-source-risk":
    case "network-target-risk":
    case "terrain-height":
    case "terrain-risk":
    case "terrain-target":
    case "terrain-baseline":
    case "terrain-forecast":
    case "terrain-volume":
    case "heat-map-metric":
    case "heat-map-secondary":
    case "heat-map-change":
    case "heat-map-target":
    case "heat-map-risk":
    case "heat-map-forecast":
    case "pulse-wave-metric":
    case "pulse-wave-baseline":
    case "pulse-wave-impact":
    case "flow-field-volume":
    case "flow-field-stage-order":
    case "flow-field-conversion":
    case "flow-field-drop-off":
    case "flow-field-avg-time":
    case "honeycomb-impact":
    case "honeycomb-progress":
    case "honeycomb-risk":
    case "honeycomb-investment":
    case "honeycomb-benefit":
    case "spiral-progress":
    case "spiral-metric":
    case "spiral-risk":
    case "spiral-cost":
      return ["none", "sum", "avg", "count", "count_distinct", "min", "max"];
    default:
      return TRANSFORMS;
  }
}

/**
 * Shown in axis popover trigger: uppercase aggregate name + field (matches transform chip labels).
 */
export function formatAxisSummary(axis: ChartAxisConfig, role: ChartAxisFieldRole): string {
  const field = typeof axis.field === "string" ? axis.field.trim() : "";
  if (role === "bar-y" && axis.transform === "count" && field.length === 0) {
    return "COUNT(*)";
  }
  if (field.length === 0) {
    return "";
  }
  if (axis.transform && axis.transform !== "none") {
    return `${axis.transform.toUpperCase()}(${field})`;
  }
  return field;
}

/**
 * Plotly / Streamlit axis title when display name is left blank: lowercase transform(field) or field.
 * Bar Y with COUNT(*) uses the literal COUNT(*).
 */
export function getAxisDerivedLabel(
  axis: ChartAxisConfig,
  role: ChartAxisFieldRole,
): string {
  const field = typeof axis.field === "string" ? axis.field.trim() : "";
  if (role === "bar-y" && axis.transform === "count" && field.length === 0) {
    return "COUNT(*)";
  }
  if (field.length === 0) {
    return "";
  }
  if (axis.transform && axis.transform !== "none") {
    return `${axis.transform}(${field})`;
  }
  return field;
}

export function getAxisTitle(
  axis: ChartAxisConfig,
  role: ChartAxisFieldRole,
): string {
  const displayName = axis.displayName.trim();
  if (displayName.length > 0) {
    return displayName;
  }
  return getAxisDerivedLabel(axis, role);
}
