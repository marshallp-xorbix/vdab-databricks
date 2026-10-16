import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { NumberPropertyEditor } from "./NumberPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface ITerrainStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Terrain Story (title + visual settings).
 * Field mappings live in {@link TerrainStoryFieldMappingsPanel} below Bindings.
 */
export const TerrainStoryPropertyEditor: FC<ITerrainStoryPropertyEditorProps> = ({
  component,
  onPropertyChange,
}) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Terrain Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <SelectPropertyEditor
          label="Terrain mode"
          value={(props.terrainMode as string) || "surface"}
          options={[
            { value: "surface", label: "Surface (3D mesh)" },
            { value: "heat_surface", label: "Heat surface" },
            { value: "ridge", label: "Ridge (isometric)" },
          ]}
          onChange={(val) => onPropertyChange("terrainMode", val)}
        />
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
        <NumberPropertyEditor
          label="Height scale"
          value={typeof props.heightScale === "number" ? props.heightScale : 1}
          min={0.1}
          max={5}
          step={0.1}
          onChange={(val) => onPropertyChange("heightScale", val)}
        />
        <SelectPropertyEditor
          label="Interpolation"
          value={(props.interpolation as string) || "bilinear"}
          options={[
            { value: "none", label: "None" },
            { value: "bilinear", label: "Bilinear" },
          ]}
          onChange={(val) => onPropertyChange("interpolation", val)}
        />
        <NumberPropertyEditor
          label="Grid resolution"
          value={
            typeof props.gridResolution === "number" ? props.gridResolution : 60
          }
          min={10}
          max={120}
          step={5}
          onChange={(val) => onPropertyChange("gridResolution", val)}
        />
        <SelectPropertyEditor
          label="Color by"
          value={(props.colorBy as string) || "height_metric"}
          options={[
            { value: "height_metric", label: "Height" },
            { value: "risk_score", label: "Risk score" },
            { value: "variance", label: "Variance" },
            { value: "category", label: "Category" },
          ]}
          onChange={(val) => onPropertyChange("colorBy", val)}
        />
        <SelectPropertyEditor
          label="Camera preset"
          value={(props.cameraPreset as string) || "angled"}
          options={[
            { value: "angled", label: "Angled" },
            { value: "top", label: "Top" },
            { value: "front", label: "Front" },
            { value: "free", label: "Free" },
          ]}
          onChange={(val) => onPropertyChange("cameraPreset", val)}
        />
        <BooleanPropertyEditor
          label="Show peak labels"
          value={
            typeof props.showPeakLabels === "boolean"
              ? props.showPeakLabels
              : true
          }
          onChange={(val) => onPropertyChange("showPeakLabels", val)}
        />
        <BooleanPropertyEditor
          label="Show valley labels"
          value={
            typeof props.showValleyLabels === "boolean"
              ? props.showValleyLabels
              : true
          }
          onChange={(val) => onPropertyChange("showValleyLabels", val)}
        />
      </div>
    </div>
  );
};