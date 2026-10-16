import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_HINT_CLASS,
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface IHeatMapStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Heat Map Story (title + visual settings).
 * Field mappings live in {@link HeatMapStoryFieldMappingsPanel} below Bindings.
 * Map scope/level are fixed to USA states in v1 and are not exposed as options.
 */
export const HeatMapStoryPropertyEditor: FC<
  IHeatMapStoryPropertyEditorProps
> = ({ component, onPropertyChange }) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Heat Map Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <p className={PROPERTY_HINT_CLASS}>
          Map: USA · Geographic level: State
        </p>
        <SelectPropertyEditor
          label="Aggregation method"
          value={(props.aggregationMethod as string) || "sum"}
          options={[
            { value: "sum", label: "Sum" },
            { value: "avg", label: "Average" },
            { value: "max", label: "Max" },
            { value: "min", label: "Min" },
          ]}
          onChange={(val) => onPropertyChange("aggregationMethod", val)}
        />
        <SelectPropertyEditor
          label="Color scale"
          value={(props.colorScale as string) || "sequential"}
          options={[
            { value: "sequential", label: "Sequential" },
            { value: "diverging", label: "Diverging" },
          ]}
          onChange={(val) => onPropertyChange("colorScale", val)}
        />
        <BooleanPropertyEditor
          label="Show labels"
          value={
            typeof props.showLabels === "boolean" ? props.showLabels : true
          }
          onChange={(val) => onPropertyChange("showLabels", val)}
        />
        <BooleanPropertyEditor
          label="Show legend"
          value={
            typeof props.showLegend === "boolean" ? props.showLegend : true
          }
          onChange={(val) => onPropertyChange("showLegend", val)}
        />
      </div>
    </div>
  );
};