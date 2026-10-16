import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { NumberPropertyEditor } from "./NumberPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_FIELD_LABEL_CLASS,
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface IAmoebaStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Amoeba Story (title + visual settings).
 * Field mappings live in {@link AmoebaStoryFieldMappingsPanel} below Bindings.
 */
export const AmoebaStoryPropertyEditor: FC<IAmoebaStoryPropertyEditorProps> = ({
  component,
  onPropertyChange,
}) => {
  const props = component.props as Record<string, unknown>;
  const pulseBy = (props.pulseBy as string) || "risk_score";
  const animationEnabled =
    typeof props.animationEnabled === "boolean" ? props.animationEnabled : true;
  const animationSpeed =
    typeof props.animationSpeed === "number" ? props.animationSpeed : 1;
  const showPulseControls = pulseBy !== "none";

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Amoeba Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <SelectPropertyEditor
          label="Layout mode"
          value={(props.layoutMode as string) || "hybrid"}
          options={[
            { value: "hybrid", label: "Hybrid" },
            { value: "scatter", label: "Scatter" },
            { value: "cluster", label: "Cluster" },
          ]}
          onChange={(val) => onPropertyChange("layoutMode", val)}
        />
        <SelectPropertyEditor
          label="Size scale"
          value={(props.sizeScale as string) || "sqrt"}
          options={[
            { value: "sqrt", label: "Square root" },
            { value: "linear", label: "Linear" },
            { value: "log", label: "Log" },
          ]}
          onChange={(val) => onPropertyChange("sizeScale", val)}
        />
        <NumberPropertyEditor
          label="Min radius (px)"
          value={typeof props.minRadiusPx === "number" ? props.minRadiusPx : 42}
          min={8}
          max={200}
          onChange={(val) => onPropertyChange("minRadiusPx", val)}
        />
        <NumberPropertyEditor
          label="Max radius (px)"
          value={typeof props.maxRadiusPx === "number" ? props.maxRadiusPx : 130}
          min={16}
          max={300}
          onChange={(val) => onPropertyChange("maxRadiusPx", val)}
        />
        <SelectPropertyEditor
          label="Color by"
          value={(props.colorBy as string) || "category"}
          options={[
            { value: "category", label: "Category" },
            { value: "health_score", label: "Health score" },
          ]}
          onChange={(val) => onPropertyChange("colorBy", val)}
        />
        <SelectPropertyEditor
          label="Pulse by"
          value={pulseBy}
          options={[
            { value: "risk_score", label: "Risk score" },
            { value: "none", label: "None" },
          ]}
          onChange={(val) => onPropertyChange("pulseBy", val)}
        />
        <NumberPropertyEditor
          label="Shape variation"
          value={
            typeof props.shapeVariation === "number" ? props.shapeVariation : 0.35
          }
          min={0}
          max={1}
          step={0.05}
          onChange={(val) => onPropertyChange("shapeVariation", val)}
        />
        <SelectPropertyEditor
          label="Label mode"
          value={(props.labelMode as string) || "compact"}
          options={[
            { value: "compact", label: "Compact" },
            { value: "full", label: "Full" },
            { value: "none", label: "None" },
          ]}
          onChange={(val) => onPropertyChange("labelMode", val)}
        />
      </div>

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Animation settings</p>
        <BooleanPropertyEditor
          label="Animation enabled"
          value={animationEnabled}
          onChange={(val) => onPropertyChange("animationEnabled", val)}
        />
        {showPulseControls && (
          <>
            <NumberPropertyEditor
              label="Pulse threshold"
              value={
                typeof props.pulseThreshold === "number"
                  ? props.pulseThreshold
                  : 50
              }
              min={0}
              max={100}
              step={1}
              onChange={(val) => onPropertyChange("pulseThreshold", val)}
            />
            <SelectPropertyEditor
              label="Pulse when"
              value={(props.pulseThresholdMode as string) || "above"}
              options={[
                { value: "above", label: "Above threshold" },
                { value: "below", label: "Below threshold" },
              ]}
              onChange={(val) => onPropertyChange("pulseThresholdMode", val)}
            />
          </>
        )}
        {animationEnabled && (
          <div>
            <label
              className={PROPERTY_FIELD_LABEL_CLASS}
              htmlFor={`amoeba-animation-speed-${component.id}`}
            >
              Animation speed ({animationSpeed.toFixed(2)}×)
            </label>
            <input
              id={`amoeba-animation-speed-${component.id}`}
              type="range"
              min={0.25}
              max={3}
              step={0.05}
              value={animationSpeed}
              onChange={(e) =>
                onPropertyChange("animationSpeed", parseFloat(e.target.value))
              }
              className="w-full accent-primary"
              aria-valuemin={0.25}
              aria-valuemax={3}
              aria-valuenow={animationSpeed}
              aria-label="Animation speed"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};