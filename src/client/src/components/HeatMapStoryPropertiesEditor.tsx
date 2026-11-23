import { Input } from "./ui/input";
import { Label } from "./ui/label";
import HeatMapStoryVisualPropertiesEditor from "./HeatMapStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IHeatMapStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function HeatMapStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IHeatMapStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Heat Map Story";

  return (
    <section className="grid gap-4" aria-label="Heat map story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Heat map story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`heat-map-title-${componentKey}`}>Title</Label>
          <Input
            id={`heat-map-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <HeatMapStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default HeatMapStoryPropertiesEditor;
