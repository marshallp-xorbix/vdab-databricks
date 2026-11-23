import { Input } from "./ui/input";
import { Label } from "./ui/label";
import PulseWaveStoryVisualPropertiesEditor from "./PulseWaveStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IPulseWaveStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function PulseWaveStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IPulseWaveStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Pulse Wave Story";

  return (
    <section className="grid gap-4" aria-label="Pulse wave story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Pulse wave story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`pulse-wave-title-${componentKey}`}>Title</Label>
          <Input
            id={`pulse-wave-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <PulseWaveStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default PulseWaveStoryPropertiesEditor;
