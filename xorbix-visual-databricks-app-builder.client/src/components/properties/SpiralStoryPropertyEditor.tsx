import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface ISpiralStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Spiral Story (title + visual settings).
 * Field mappings live in {@link SpiralStoryFieldMappingsPanel} below Bindings.
 */
export const SpiralStoryPropertyEditor: FC<ISpiralStoryPropertyEditorProps> = ({
  component,
  onPropertyChange,
}) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Spiral Story"}
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
          label="Show risk glow"
          value={
            typeof props.showRiskGlow === "boolean" ? props.showRiskGlow : true
          }
          onChange={(val) => onPropertyChange("showRiskGlow", val)}
        />
        <BooleanPropertyEditor
          label="Show schedule variance"
          value={
            typeof props.showVariance === "boolean" ? props.showVariance : true
          }
          onChange={(val) => onPropertyChange("showVariance", val)}
        />
        <BooleanPropertyEditor
          label="Space by timeline"
          value={
            typeof props.spaceByTimeline === "boolean"
              ? props.spaceByTimeline
              : false
          }
          onChange={(val) => onPropertyChange("spaceByTimeline", val)}
        />
      </div>
    </div>
  );
};