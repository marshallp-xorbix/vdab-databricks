import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface IHoneycombStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Honeycomb Story (title + visual settings).
 * Field mappings live in {@link HoneycombStoryFieldMappingsPanel} below Bindings.
 */
export const HoneycombStoryPropertyEditor: FC<
  IHoneycombStoryPropertyEditorProps
> = ({ component, onPropertyChange }) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Honeycomb Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <BooleanPropertyEditor
          label="Show labels"
          value={
            typeof props.showLabels === "boolean" ? props.showLabels : true
          }
          onChange={(val) => onPropertyChange("showLabels", val)}
        />
        <BooleanPropertyEditor
          label="Show risk borders"
          value={
            typeof props.showRiskBorders === "boolean"
              ? props.showRiskBorders
              : true
          }
          onChange={(val) => onPropertyChange("showRiskBorders", val)}
        />
        <BooleanPropertyEditor
          label="Show trend arrows"
          value={
            typeof props.showTrendArrows === "boolean"
              ? props.showTrendArrows
              : true
          }
          onChange={(val) => onPropertyChange("showTrendArrows", val)}
        />
      </div>
    </div>
  );
};