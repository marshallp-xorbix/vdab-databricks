import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface IPulseWaveStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Pulse Wave Story (title + visual settings).
 * Field mappings live in {@link PulseWaveStoryFieldMappingsPanel} below Bindings.
 */
export const PulseWaveStoryPropertyEditor: FC<
  IPulseWaveStoryPropertyEditorProps
> = ({ component, onPropertyChange }) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Pulse Wave Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />
      <StringPropertyEditor
        label="Metric name"
        value={(props.metricName as string) || "Metric"}
        onChange={(val) => onPropertyChange("metricName", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
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
        <BooleanPropertyEditor
          label="Show baseline"
          value={
            typeof props.showBaseline === "boolean" ? props.showBaseline : true
          }
          onChange={(val) => onPropertyChange("showBaseline", val)}
        />
        <BooleanPropertyEditor
          label="Show events"
          value={
            typeof props.showEvents === "boolean" ? props.showEvents : true
          }
          onChange={(val) => onPropertyChange("showEvents", val)}
        />
        <BooleanPropertyEditor
          label="Show anomaly markers"
          value={
            typeof props.showAnomalyMarkers === "boolean"
              ? props.showAnomalyMarkers
              : true
          }
          onChange={(val) => onPropertyChange("showAnomalyMarkers", val)}
        />
        <BooleanPropertyEditor
          label="Fill under wave"
          value={
            typeof props.fillUnderWave === "boolean"
              ? props.fillUnderWave
              : true
          }
          onChange={(val) => onPropertyChange("fillUnderWave", val)}
        />
      </div>
    </div>
  );
};