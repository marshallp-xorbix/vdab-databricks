import type { VdabComponent } from "../../types/components";
import type { FC } from "react";
import { StringPropertyEditor } from "./StringPropertyEditor";
import {
  defaultChartAxis,
  parseChartAxis,
  type ChartAxisConfig,
} from "../../types/chartAxisConfig";
import { getBoundTableColumnsFromComponent } from "../../utils/charts/chartBindingColumns";
import { ChartAxisFieldPopover } from "./ChartAxisFieldPopover";
import { SeriesColorPropertyEditor } from "./SeriesColorPropertyEditor";

interface LineChartPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

export const LineChartPropertyEditor: FC<LineChartPropertyEditorProps> = ({
  component,
  onPropertyChange,
}) => {
  const props = component.props as Record<string, unknown>;
  const xAxis: ChartAxisConfig = {
    ...defaultChartAxis({
      scaleType: "continuous",
    }),
    ...parseChartAxis(props.xAxis),
  };
  const yAxis: ChartAxisConfig = {
    ...defaultChartAxis({
      scaleType: "continuous",
    }),
    ...parseChartAxis(props.yAxis),
  };

  const columns = getBoundTableColumnsFromComponent(component);

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Line Chart"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <SeriesColorPropertyEditor
        value={props.seriesColor as string | undefined}
        onChange={(next) => onPropertyChange("seriesColor", next)}
        label="Series color"
      />

      <div className="space-y-4 pt-2 border-t border-border">
        <ChartAxisFieldPopover
          label="X axis"
          role="line-x"
          axis={xAxis}
          columns={columns}
          onChange={(next) => onPropertyChange("xAxis", next)}
        />
        <ChartAxisFieldPopover
          label="Y axis"
          role="line-y"
          axis={yAxis}
          columns={columns}
          onChange={(next) => onPropertyChange("yAxis", next)}
        />
        {columns.length === 0 ? (
          <div className="rounded bg-warning-subtle p-2 text-xs text-warning">
            No columns found. Bind a table in the Bindings tab first.
          </div>
        ) : null}
      </div>
    </div>
  );
};
