import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import AmoebaStoryFieldMappingsEditor from "./AmoebaStoryFieldMappingsEditor";
import AmoebaStoryVisualPropertiesEditor from "./AmoebaStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { readUnityCatalogTableBinding } from "../utils/projectDataWindowBinding";

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
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IAmoebaStoryPropertiesEditorProps>) {
  const table = readUnityCatalogTableBinding(bindings);
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
      <DataWindowTableBindingEditor
        componentKey={componentKey}
        bindings={bindings}
        disabled={disabled}
        primaryKeyRequired={false}
        onBindingsChange={onBindingsChange}
      />
      <AmoebaStoryFieldMappingsEditor
        componentKey={componentKey}
        properties={properties}
        columns={table?.columns ?? []}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      <AmoebaStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      {table?.table && table.columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure the story mappings.
        </p>
      )}
    </section>
  );
}

export default AmoebaStoryPropertiesEditor;
