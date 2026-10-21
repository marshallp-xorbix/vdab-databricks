import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import PulseWaveStoryFieldMappingsEditor from "./PulseWaveStoryFieldMappingsEditor";
import PulseWaveStoryVisualPropertiesEditor from "./PulseWaveStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import { readUnityCatalogTableBinding } from "../utils/projectDataWindowBinding";

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
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IPulseWaveStoryPropertiesEditorProps>) {
  const table = readUnityCatalogTableBinding(bindings);
  const title = typeof properties.title === "string" ? properties.title : "Pulse Wave Story";
  const metricName = typeof properties.metricName === "string" ? properties.metricName : "Metric";
  const columns: IWorkspaceTableColumn[] = table?.columns ?? [];

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
        <div className="grid gap-2">
          <Label htmlFor={`pulse-wave-metric-name-${componentKey}`}>Metric name</Label>
          <Input
            id={`pulse-wave-metric-name-${componentKey}`}
            maxLength={500}
            value={metricName}
            onChange={(event) => onPropertiesChange({ ...properties, metricName: event.target.value })}
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
      <PulseWaveStoryFieldMappingsEditor
        componentKey={componentKey}
        properties={properties}
        columns={columns}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      <PulseWaveStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
      {table?.table && columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          The selected table does not include column metadata. Reselect it to configure time-series fields.
        </p>
      )}
    </section>
  );
}

export default PulseWaveStoryPropertiesEditor;
