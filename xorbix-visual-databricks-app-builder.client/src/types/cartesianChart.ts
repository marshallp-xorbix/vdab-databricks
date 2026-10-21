export type ChartAxisKind = "xAxis" | "yAxis" | "category" | "value";
export type ChartAxisScale = "categorical" | "continuous";
export type ChartAxisTransform =
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

export interface ChartAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: ChartAxisScale;
  transform: ChartAxisTransform;
}
