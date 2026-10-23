import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import HeatMapStoryFieldMappingsEditor from "./HeatMapStoryFieldMappingsEditor";
import HeatMapStoryVisualPropertiesEditor from "./HeatMapStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import { readProjectTableBinding } from "../utils/projectDataWindowBinding";

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
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IHeatMapStoryPropertiesEditorProps>) {
  const table = readProjectTableBinding(bindings);
  const title = typeof properties.title === "string" ? properties.title : "Heat Map Story";
  const columns: IWorkspaceTableColumn[] = table?.columns ?? [];

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
      <DataWindowTableBindingEditor
        componentKey={componentKey}
        bindings={bindings}
        disabled={disabled}
        primaryKeyRequired={false}
        onBindingsChange={onBindingsChange}
      />
      <HeatMapStoryFieldMappingsEditor
        componentKey={componentKey}
        properties={properties}
        columns={columns}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      <HeatMapStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      {table?.table && columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure heat map mappings.
        </p>
      )}
    </section>
  );
}

export default HeatMapStoryPropertiesEditor;
