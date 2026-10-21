import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import type {
  ChartAxisKind,
  ChartAxisTransform,
  ChartAxisConfiguration,
} from "../types/cartesianChart";
import {
  getCartesianChartAxisScales,
  getCartesianChartAxisTransforms,
} from "../utils/cartesianChartConfiguration";

interface ICartesianChartAxisPropertiesEditorProps {
  chartType: "BarChart" | "LineChart" | "PieChart" | "DonutChart";
  componentKey: string;
  axis: ChartAxisConfiguration;
  axisKind: ChartAxisKind;
  columns: IWorkspaceTableColumn[];
  disabled: boolean;
  onChange: (axis: ChartAxisConfiguration) => void;
}

const TRANSFORM_LABELS: Record<ChartAxisTransform, string> = {
  none: "Sum",
  sum: "Sum",
  avg: "Average",
  count: "Count",
  count_distinct: "Count distinct",
  min: "Minimum",
  max: "Maximum",
  yearly: "Yearly",
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
};

function CartesianChartAxisPropertiesEditor({
  chartType,
  componentKey,
  axis,
  axisKind,
  columns,
  disabled,
  onChange,
}: Readonly<ICartesianChartAxisPropertiesEditorProps>) {
  const isRadial = chartType === "PieChart" || chartType === "DonutChart";
  const label = axisKind === "category"
    ? "Category"
    : axisKind === "value" ? "Value" : axisKind === "xAxis" ? "X axis" : "Y axis";
  const chartName = chartType === "PieChart" ? "pie" : chartType === "DonutChart" ? "donut" : chartType === "LineChart" ? "line" : "bar";
  const fieldId = `${chartName}-chart-${axisKind}-field-${componentKey}`;
  const displayNameId = `${chartName}-chart-${axisKind}-display-name-${componentKey}`;
  const scaleId = `${chartName}-chart-${axisKind}-scale-${componentKey}`;
  const transformId = `${chartName}-chart-${axisKind}-transform-${componentKey}`;
  const column = columns.find((item) => item.name === axis.field) ?? null;
  const scales = getCartesianChartAxisScales(axisKind, column);
  const transforms = getCartesianChartAxisTransforms(axisKind, column, chartType);
  const selectedFieldMissing = axis.field !== "" && column === null;
  const scaleOptions = scales.includes(axis.scaleType)
    ? scales
    : [axis.scaleType, ...scales];
  const transformOptions = transforms.includes(axis.transform)
    ? transforms
    : [axis.transform, ...transforms];
  const fieldOptions = axis.field !== "" && selectedFieldMissing
    ? [axis.field, ...columns.map((item) => item.name)]
    : columns.map((item) => item.name);

  function changeField(field: string) {
    const nextColumn = columns.find((item) => item.name === field) ?? null;
    const nextTransforms = getCartesianChartAxisTransforms(axisKind, nextColumn, chartType);
    const nextScales = getCartesianChartAxisScales(axisKind, nextColumn);
    onChange({
      ...axis,
      field,
      transform: nextTransforms.includes(axis.transform)
        ? axis.transform
        : (nextTransforms[0] ?? "none"),
      scaleType: nextScales.includes(axis.scaleType)
        ? axis.scaleType
        : "categorical",
    });
  }

  return (
    <fieldset className="grid gap-3 rounded-md border border-border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2">
        <Label htmlFor={fieldId}>Column</Label>
        <select
          id={fieldId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={axis.field}
          onChange={(event) => changeField(event.target.value)}
        >
          <option value="">{axisKind === "yAxis" && chartType === "BarChart" ? "No column (COUNT*)" : "Choose a column"}</option>
          {fieldOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {selectedFieldMissing && (
          <p role="status" className="text-xs text-muted-foreground">
            The saved column is unavailable. Choose a visible column from the hosting workspace.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={displayNameId}>{isRadial ? `${label} label` : "Axis title"}</Label>
        <Input
          id={displayNameId}
          maxLength={500}
          value={axis.displayName}
          onChange={(event) => onChange({ ...axis, displayName: event.target.value })}
        />
      </div>
      {!isRadial && <div className="grid gap-2">
        <Label htmlFor={scaleId}>Scale</Label>
        <select
          id={scaleId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={axis.scaleType}
          onChange={(event) => onChange({
            ...axis,
            scaleType: event.target.value === "continuous" ? "continuous" : "categorical",
          })}
        >
          {scaleOptions.map((scale) => <option key={scale} value={scale}>{scale}</option>)}
        </select>
      </div>}
      <div className="grid gap-2">
        <Label htmlFor={transformId}>
          {axisKind === "category"
            ? "Transform"
            : axisKind === "value"
              ? "Aggregation"
              : axisKind === "xAxis"
            ? chartType === "LineChart" ? "X axis transform" : "Date bucket"
            : "Aggregation"}
        </Label>
        <select
          id={transformId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={axis.transform}
          onChange={(event) => onChange({ ...axis, transform: event.target.value as ChartAxisTransform })}
        >
          {transformOptions.map((transform) => {
            const transformLabel = transform === "none" && (
              axisKind === "category" || chartType === "LineChart" || isRadial
            )
              ? axisKind === "category" ? "No transform" : "Raw values"
              : TRANSFORM_LABELS[transform];
            return (
              <option key={transform} value={transform}>
                {transformLabel}
              </option>
            );
          })}
        </select>
      </div>
    </fieldset>
  );
}

export default CartesianChartAxisPropertiesEditor;
