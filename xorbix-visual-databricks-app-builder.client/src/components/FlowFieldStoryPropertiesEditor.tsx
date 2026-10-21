import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import FlowFieldStoryFieldMappingsEditor from "./FlowFieldStoryFieldMappingsEditor";
import FlowFieldStoryVisualPropertiesEditor from "./FlowFieldStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import { readUnityCatalogTableBinding } from "../utils/projectDataWindowBinding";

interface IFlowFieldStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function FlowFieldStoryPropertiesEditor({
  componentKey,
  properties,
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IFlowFieldStoryPropertiesEditorProps>) {
  const table = readUnityCatalogTableBinding(bindings);
  const title = typeof properties.title === "string" ? properties.title : "Flow Field Story";
  const columns: IWorkspaceTableColumn[] = table?.columns ?? [];

  return (
    <section className="grid gap-4" aria-label="Flow field story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Flow field story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`flow-field-title-${componentKey}`}>Title</Label>
          <Input
            id={`flow-field-title-${componentKey}`}
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
      <FlowFieldStoryFieldMappingsEditor
        componentKey={componentKey}
        properties={properties}
        columns={columns}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      <FlowFieldStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      {table?.table && columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure flow mappings.
        </p>
      )}
    </section>
  );
}

export default FlowFieldStoryPropertiesEditor;
