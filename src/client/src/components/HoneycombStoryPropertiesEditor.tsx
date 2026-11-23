import { Input } from "./ui/input";
import { Label } from "./ui/label";
import HoneycombStoryVisualPropertiesEditor from "./HoneycombStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IHoneycombStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function HoneycombStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IHoneycombStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Honeycomb Story";

  return (
    <section className="grid gap-4" aria-label="Honeycomb story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Honeycomb story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`honeycomb-title-${componentKey}`}>Title</Label>
          <Input
            id={`honeycomb-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <HoneycombStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default HoneycombStoryPropertiesEditor;
