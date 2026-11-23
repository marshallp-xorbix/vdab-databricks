import { Input } from "./ui/input";
import { Label } from "./ui/label";
import TerrainStoryVisualPropertiesEditor from "./TerrainStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface ITerrainStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function TerrainStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<ITerrainStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Terrain Story";

  return (
    <section className="grid gap-4" aria-label="Terrain story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Terrain story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`terrain-title-${componentKey}`}>Title</Label>
          <Input
            id={`terrain-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <TerrainStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default TerrainStoryPropertiesEditor;
