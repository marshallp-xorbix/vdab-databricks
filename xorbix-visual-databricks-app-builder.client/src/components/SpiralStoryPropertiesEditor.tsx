import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import SpiralStoryFieldMappingsEditor from "./SpiralStoryFieldMappingsEditor";
import SpiralStoryVisualPropertiesEditor from "./SpiralStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import { readProjectTableBinding } from "../utils/projectDataWindowBinding";

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
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<ISpiralStoryPropertiesEditorProps>) {
  const table = readProjectTableBinding(bindings);
  const title = typeof properties.title === "string" ? properties.title : "Spiral Story";
  const columns: IWorkspaceTableColumn[] = table?.columns ?? [];

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
      <DataWindowTableBindingEditor
        componentKey={componentKey}
        bindings={bindings}
        disabled={disabled}
        primaryKeyRequired={false}
        onBindingsChange={onBindingsChange}
      />
      <SpiralStoryFieldMappingsEditor
        componentKey={componentKey}
        properties={properties}
        columns={columns}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      <SpiralStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      {table?.table && columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure journey fields.
        </p>
      )}
    </section>
  );
}

export default SpiralStoryPropertiesEditor;
