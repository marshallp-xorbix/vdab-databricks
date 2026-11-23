import { Input } from "./ui/input";
import { Label } from "./ui/label";
import AmoebaStoryVisualPropertiesEditor from "./AmoebaStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IAmoebaStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function AmoebaStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IAmoebaStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Amoeba Story";

  return (
    <section className="grid gap-4" aria-label="Amoeba story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Amoeba story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`amoeba-title-${componentKey}`}>Title</Label>
          <Input
            id={`amoeba-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <AmoebaStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default AmoebaStoryPropertiesEditor;
