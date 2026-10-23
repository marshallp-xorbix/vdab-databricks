import { Input } from "./ui/input";
import { Label } from "./ui/label";
import CartesianChartAxisPropertiesEditor from "./CartesianChartAxisPropertiesEditor";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import type { ChartAxisConfiguration } from "../types/cartesianChart";
import { readProjectTableBinding } from "../utils/projectDataWindowBinding";
import { readCartesianChartAxis } from "../utils/cartesianChartConfiguration";

interface ICartesianChartPropertiesEditorProps {
  chartType: "BarChart" | "LineChart" | "PieChart" | "DonutChart";
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function CartesianChartPropertiesEditor({
  chartType,
  componentKey,
  properties,
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<ICartesianChartPropertiesEditorProps>) {
  const isRadial = chartType === "PieChart" || chartType === "DonutChart";
  const dimensionProperty = isRadial ? "category" : "xAxis";
  const measureProperty = isRadial ? "value" : "yAxis";
  const dimensionKind = isRadial ? "category" : "xAxis";
  const measureKind = isRadial ? "value" : "yAxis";
  const dimensionAxis = readCartesianChartAxis(properties[dimensionProperty], dimensionKind, chartType);
  const measureAxis = readCartesianChartAxis(properties[measureProperty], measureKind, chartType);
  const table = readProjectTableBinding(bindings);
  const chartName = chartType === "PieChart" ? "pie" : chartType === "DonutChart" ? "donut" : chartType === "LineChart" ? "line" : "bar";
  const chartLabel = chartType === "PieChart" ? "Pie" : chartType === "DonutChart" ? "Donut" : chartType === "LineChart" ? "Line" : "Bar";
  const titleId = `${chartName}-chart-title-${componentKey}`;
  const colorId = `${chartName}-chart-color-${componentKey}`;
  const title = typeof properties.title === "string"
    ? properties.title
    : `${chartLabel} Chart`;
  const color = typeof properties.seriesColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(properties.seriesColor)
    ? properties.seriesColor
    : "#1f77b4";
  const columns: IWorkspaceTableColumn[] = table?.columns ?? [];

  function changeAxis(axisProperty: "xAxis" | "yAxis" | "category" | "value", axis: ChartAxisConfiguration) {
    onPropertiesChange({ ...properties, [axisProperty]: axis });
  }

  return (
    <section className="grid gap-4" aria-label={`${chartLabel} chart configuration`}>
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">{chartLabel} chart properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={colorId}>Series color</Label>
          <Input
            id={colorId}
            type="color"
            value={color}
            onChange={(event) => onPropertiesChange({ ...properties, seriesColor: event.target.value })}
          />
        </div>
      </fieldset>
      <DataWindowTableBindingEditor
        componentKey={componentKey}
        bindings={bindings}
        disabled={disabled}
        primaryKeyRequired={false}
        onBindingsChange={onBindingsChange}
      />
      <CartesianChartAxisPropertiesEditor
        componentKey={componentKey}
        chartType={chartType}
        axis={dimensionAxis}
        axisKind={dimensionKind}
        columns={columns}
        disabled={disabled}
        onChange={(axis) => changeAxis(dimensionProperty, axis)}
      />
      <CartesianChartAxisPropertiesEditor
        componentKey={componentKey}
        chartType={chartType}
        axis={measureAxis}
        axisKind={measureKind}
        columns={columns}
        disabled={disabled}
        onChange={(axis) => changeAxis(measureProperty, axis)}
      />
      {table?.table && columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure chart axes.
        </p>
      )}
    </section>
  );
}

export default CartesianChartPropertiesEditor;
