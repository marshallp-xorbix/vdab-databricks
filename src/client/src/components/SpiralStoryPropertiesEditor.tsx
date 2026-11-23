import { Input } from "./ui/input";
import { Label } from "./ui/label";
import SpiralStoryVisualPropertiesEditor from "./SpiralStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface ISpiralStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function SpiralStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<ISpiralStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Spiral Story";

  return (
    <section className="grid gap-4" aria-label="Spiral story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Spiral story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`spiral-title-${componentKey}`}>Title</Label>
          <Input
            id={`spiral-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <SpiralStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default SpiralStoryPropertiesEditor;
