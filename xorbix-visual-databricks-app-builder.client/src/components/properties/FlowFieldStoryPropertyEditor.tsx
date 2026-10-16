import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface IFlowFieldStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Flow Field Story (title + visual settings).
 * Field mappings live in {@link FlowFieldStoryFieldMappingsPanel} below Bindings.
 */
export const FlowFieldStoryPropertyEditor: FC<
  IFlowFieldStoryPropertyEditorProps
> = ({ component, onPropertyChange }) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Flow Field Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <BooleanPropertyEditor
          label="Show drop-offs"
          value={
            typeof props.showDropOffs === "boolean" ? props.showDropOffs : true
          }
          onChange={(val) => onPropertyChange("showDropOffs", val)}
        />
        <BooleanPropertyEditor
          label="Show labels"
          value={
            typeof props.showLabels === "boolean" ? props.showLabels : true
          }
          onChange={(val) => onPropertyChange("showLabels", val)}
        />
      </div>
    </div>
  );
};