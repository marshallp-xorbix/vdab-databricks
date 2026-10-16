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

interface DonutChartPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

export const DonutChartPropertyEditor: FC<DonutChartPropertyEditorProps> = ({
  component,
  onPropertyChange,
}) => {
  const props = component.props as Record<string, unknown>;
  const category: ChartAxisConfig = {
    ...defaultChartAxis({
      scaleType: "categorical",
    }),
    ...parseChartAxis(props.category),
  };
  const value: ChartAxisConfig = {
    ...defaultChartAxis({
      scaleType: "continuous",
      transform: "sum",
    }),
    ...parseChartAxis(props.value),
  };

  const columns = getBoundTableColumnsFromComponent(component);

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Donut Chart"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <SeriesColorPropertyEditor
        value={props.seriesColor as string | undefined}
        onChange={(next) => onPropertyChange("seriesColor", next)}
        label="Palette base color"
        hint="Used as the base hue for auto-generated slice colors."
      />

      <div className="space-y-4 pt-2 border-t border-border">
        <ChartAxisFieldPopover
          label="Category"
          role="pie-category"
          axis={category}
          columns={columns}
          onChange={(next) => onPropertyChange("category", next)}
        />
        <ChartAxisFieldPopover
          label="Value"
          role="pie-value"
          axis={value}
          columns={columns}
          onChange={(next) => onPropertyChange("value", next)}
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
