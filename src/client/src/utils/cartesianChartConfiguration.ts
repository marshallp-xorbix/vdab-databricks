import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import type {
  ChartAxisKind,
  ChartAxisTransform,
  ChartAxisConfiguration,
} from "../types/cartesianChart";

const X_AXIS_TRANSFORMS: ChartAxisTransform[] = [
  "none", "yearly", "monthly", "weekly", "daily",
];
const NUMERIC_Y_TRANSFORMS: ChartAxisTransform[] = [
  "none", "sum", "avg", "count", "count_distinct", "min", "max",
];
const TEMPORAL_Y_TRANSFORMS: ChartAxisTransform[] = [
  "count", "count_distinct", "min", "max",
];
const CATEGORICAL_Y_TRANSFORMS: ChartAxisTransform[] = [
  "count", "count_distinct",
];

/** Reads persisted axis JSON without trusting its runtime shape. */
export function readCartesianChartAxis(
  value: unknown,
  kind: ChartAxisKind,
  chartType: "BarChart" | "LineChart" | "PieChart" | "DonutChart" = "BarChart",
): ChartAxisConfiguration {
  const isRadialCategory = isRadialChart(chartType) && kind === "category";
  const isRadialValue = isRadialChart(chartType) && kind === "value";
  const defaultTransform = isRadialCategory || kind === "xAxis" || chartType === "LineChart"
    ? "none"
    : isRadialValue ? "sum" : "count";
  const defaultScale = isRadialCategory || kind === "xAxis" && chartType === "BarChart"
    ? "categorical"
    : "continuous";
  const axis = isRecord(value) ? value : {};
  const scaleType = axis.scaleType === "continuous" ? "continuous" : defaultScale;
  const transform = isTransform(axis.transform)
    ? axis.transform
    : defaultTransform;

  return {
    field: typeof axis.field === "string" ? axis.field : "",
    displayName: typeof axis.displayName === "string" ? axis.displayName : "",
    scaleType,
    transform,
  };
}

/** Lists safe axis transforms for the currently selected table column. */
export function getCartesianChartAxisTransforms(
  kind: ChartAxisKind,
  column: IWorkspaceTableColumn | null,
  chartType: "BarChart" | "LineChart" | "PieChart" | "DonutChart" = "BarChart",
): ChartAxisTransform[] {
  if (kind === "category") {
    return ["none"];
  }
  if (kind === "xAxis") {
    if (chartType === "LineChart") {
      return ["none"];
    }
    return getColumnCategory(column) === "temporal"
      ? X_AXIS_TRANSFORMS
      : ["none"];
  }

  if (column === null && isRadialChart(chartType)) {
    return NUMERIC_Y_TRANSFORMS;
  }
  if (column === null) {
    return ["count"];
  }
  const category = getColumnCategory(column);
  if (category === "numeric") {
    return NUMERIC_Y_TRANSFORMS;
  }
  if (category === "temporal") {
    return TEMPORAL_Y_TRANSFORMS;
  }
  return CATEGORICAL_Y_TRANSFORMS;
}

function isRadialChart(chartType: "BarChart" | "LineChart" | "PieChart" | "DonutChart"): boolean {
  return chartType === "PieChart" || chartType === "DonutChart";
}

/** Returns axis scales that match the selected column type. */
export function getCartesianChartAxisScales(
  kind: ChartAxisKind,
  column: IWorkspaceTableColumn | null,
): Array<"categorical" | "continuous"> {
  if (kind === "category") {
    return ["categorical"];
  }
  if (kind === "value") {
    return ["continuous"];
  }
  if (kind === "yAxis" || column === null) {
    return ["categorical", "continuous"];
  }
  const category = getColumnCategory(column);
  return category === "numeric" || category === "temporal"
    ? ["categorical", "continuous"]
    : ["categorical"];
}

function getColumnCategory(
  column: IWorkspaceTableColumn | null,
): "numeric" | "temporal" | "categorical" | "unknown" {
  const typeText = (column?.type ?? column?.dataType ?? "").trim().toUpperCase();
  if (/^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|FLOAT|DOUBLE|DECIMAL|NUMERIC)(\b|\s*\()/.test(typeText)) {
    return "numeric";
  }
  if (/^(DATE|TIMESTAMP|TIMESTAMP_NTZ|TIME)(\b|\s*\()/.test(typeText)) {
    return "temporal";
  }
  if (/^(STRING|CHAR|VARCHAR|BOOLEAN|BOOL)(\b|\s*\()/.test(typeText)) {
    return "categorical";
  }
  return "unknown";
}

function isTransform(value: unknown): value is ChartAxisTransform {
  return value === "none" || value === "sum" || value === "avg" ||
    value === "count" || value === "count_distinct" || value === "min" ||
    value === "max" || value === "yearly" || value === "monthly" ||
    value === "weekly" || value === "daily";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
