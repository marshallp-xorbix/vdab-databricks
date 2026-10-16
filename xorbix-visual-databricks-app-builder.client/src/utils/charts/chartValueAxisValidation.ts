import type { ChartFieldTransform } from "../../types/chartAxisConfig";
import type { VdabComponent } from "../../types/components";
import { ComponentType } from "../../types/components/componentTypes";
import {
  getChartColumnTypeCategory,
  type ChartColumnTypeCategory,
} from "../chartColumnTypeUtils";
import { getBoundTableColumnsFromComponent } from "./chartBindingColumns";

/**
 * Roles that bind a **measure** (numeric result) for cartesian and radial charts.
 * Used with {@link getMeasureTransformsForColumn} — same rules as generated Streamlit (`pd.to_numeric` on values).
 */
export type ChartMeasureRole =
  | "line-y"
  | "bar-y"
  | "pie-value"
  | "amoeba-size"
  | "amoeba-x"
  | "amoeba-y"
  | "amoeba-change"
  | "amoeba-health"
  | "amoeba-risk"
  | "network-relationship-weight"
  | "network-edge-value"
  | "network-frequency"
  | "network-edge-risk"
  | "network-source-value"
  | "network-target-value"
  | "network-source-health"
  | "network-target-health"
  | "network-source-risk"
  | "network-target-risk"
  | "terrain-height"
  | "terrain-risk"
  | "terrain-target"
  | "terrain-baseline"
  | "terrain-forecast"
  | "terrain-volume"
  | "heat-map-metric"
  | "heat-map-secondary"
  | "heat-map-change"
  | "heat-map-target"
  | "heat-map-risk"
  | "heat-map-forecast";

/**
 * Transforms allowed for chart **value** axes (line Y, bar Y, pie/donut value).
 * String/boolean/timestamp columns cannot use "none" where the template expects numeric values.
 * Amoeba measure roles always aggregate numerically in generated SQL, so unknown types
 * still offer sum/avg/min/max (Lakebase may omit or use unfamiliar type strings).
 */
export function getMeasureTransformsForColumn(
  columnCategory: ChartColumnTypeCategory,
  role: ChartMeasureRole,
  options?: { barAllowEmptyField?: boolean; hasField: boolean },
): ChartFieldTransform[] {
  if (role === "bar-y" && options?.barAllowEmptyField && !options.hasField) {
    return ["count"];
  }

  const isAmoebaMeasure =
    role === "amoeba-size" ||
    role === "amoeba-x" ||
    role === "amoeba-y" ||
    role === "amoeba-change" ||
    role === "amoeba-health" ||
    role === "amoeba-risk";

  const isTerrainMeasure =
    role === "terrain-height" ||
    role === "terrain-risk" ||
    role === "terrain-target" ||
    role === "terrain-baseline" ||
    role === "terrain-forecast" ||
    role === "terrain-volume";

  const isHeatMapMeasure =
    role === "heat-map-metric" ||
    role === "heat-map-secondary" ||
    role === "heat-map-change" ||
    role === "heat-map-target" ||
    role === "heat-map-risk" ||
    role === "heat-map-forecast";

  const isNetworkMeasure =
    role === "network-relationship-weight" ||
    role === "network-edge-value" ||
    role === "network-frequency" ||
    role === "network-edge-risk" ||
    role === "network-source-value" ||
    role === "network-target-value" ||
    role === "network-source-health" ||
    role === "network-target-health" ||
    role === "network-source-risk" ||
    role === "network-target-risk";

  // Edge-list network SQL selects raw columns (no GROUP BY), so keep "none".
  if (isNetworkMeasure) {
    return ["none"];
  }

  const numericTransforms: ChartFieldTransform[] = [
    "none",
    "sum",
    "avg",
    "min",
    "max",
    "count",
    "count_distinct",
  ];

  const forceNumericAgg =
    isAmoebaMeasure || isTerrainMeasure || isHeatMapMeasure;

  switch (columnCategory) {
    case "numeric":
      return numericTransforms;
    case "temporal":
      return ["count", "count_distinct", "min", "max"];
    case "string":
    case "boolean":
      return forceNumericAgg
        ? numericTransforms
        : ["count", "count_distinct"];
    case "unknown":
    default:
      return forceNumericAgg
        ? numericTransforms
        : ["count", "count_distinct"];
  }
}

function measureRoleForComponent(
  type: ComponentType,
): ChartMeasureRole | null {
  switch (type) {
    case ComponentType.LineChart:
      return "line-y";
    case ComponentType.BarChart:
      return "bar-y";
    case ComponentType.PieChart:
    case ComponentType.DonutChart:
      return "pie-value";
    default:
      return null;
  }
}

/**
 * Returns a human-readable error if a chart value axis (Y or pie/donut Value) is invalid for save;
 * otherwise null. When the bound table has no column metadata, only structural rules apply.
 */
export function getChartValueAxisSaveValidationError(
  component: VdabComponent,
): string | null {
  const measureRole = measureRoleForComponent(component.type);
  if (measureRole === null) {
    return null;
  }

  const props = component.props as Record<string, unknown>;
  const axisKey = component.type === ComponentType.LineChart ||
      component.type === ComponentType.BarChart
    ? "yAxis"
    : "value";
  const axisRaw = props[axisKey];
  if (!axisRaw || typeof axisRaw !== "object") {
    return "Chart is missing value axis configuration (Y or Value).";
  }

  const axis = axisRaw as Record<string, unknown>;
  const field = typeof axis.field === "string" ? axis.field.trim() : "";
  const transform =
    typeof axis.transform === "string" ? axis.transform.toLowerCase() : "none";

  const isBar = component.type === ComponentType.BarChart;
  if (isBar && transform === "count" && field.length === 0) {
    return null;
  }

  if (field.length === 0) {
    if (component.type === ComponentType.LineChart) {
      return "Line chart requires a Y axis column (or use a bar chart with COUNT(*) for row counts).";
    }
    if (component.type === ComponentType.BarChart) {
      return "Bar chart Y axis needs a column, or set transform to COUNT with no column for COUNT(*).";
    }
    return "Pie and donut charts require a Value column.";
  }

  const columns = getBoundTableColumnsFromComponent(component);
  const col = columns.find((c) => c.name === field);
  const typeText = col?.type;
  const category = getChartColumnTypeCategory(typeText);

  if (columns.length === 0 || !typeText) {
    return null;
  }

  const allowed = getMeasureTransformsForColumn(category, measureRole, {
    barAllowEmptyField: true,
    hasField: true,
  });
  const normalizedTf = transform === "" ? "none" : transform;
  if (!allowed.includes(normalizedTf as ChartFieldTransform)) {
    const label =
      category === "string" || category === "boolean"
        ? "text or boolean"
        : category === "temporal"
          ? "date/time"
          : category === "unknown"
            ? "untyped"
            : "numeric";
    const axisHint =
      component.type === ComponentType.PieChart ||
      component.type === ComponentType.DonutChart
        ? "Value"
        : "Y";
    return `${axisHint} axis: column "${field}" (${label}) cannot use this transform. Use one of: ${allowed.map((t) => (t === "none" ? "None" : t.toUpperCase())).join(", ")}.`;
  }

  return null;
}
