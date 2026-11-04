import { Input } from "./ui/input";
import { Label } from "./ui/label";
import DataWindowTableBindingEditor from "./DataWindowTableBindingEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IDataWindowPropertiesEditorProps {
  componentKey: string;
  editable: boolean;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function DataWindowPropertiesEditor({
  componentKey,
  editable,
  properties,
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IDataWindowPropertiesEditorProps>) {
  function changeProperty(propertyName: string, value: string | number | boolean | null) {
    onPropertiesChange({ ...properties, [propertyName]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{editable ? "Editable DataWindow properties" : "DataWindow properties"}</legend>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-label-${componentKey}`}>Label</Label>
        <Input
          id={`data-window-label-${componentKey}`}
          maxLength={500}
          value={readText(properties.label, editable ? "Editable Data Table" : "Data Table")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-rows-${componentKey}`}>Maximum rows (0 means no explicit limit)</Label>
        <Input
          id={`data-window-rows-${componentKey}`}
          type="number"
          min={0}
          max={1_000_000}
          step={1}
          value={readNumber(properties.maxRows, 0)}
          onChange={(event) => changeProperty("maxRows", readInputNumber(event.target.value))}
        />
      </div>
      {editable && (
        <div className="grid gap-2">
          <Label htmlFor={`editable-data-window-num-rows-${componentKey}`}>Row editing</Label>
          <select
            id={`editable-data-window-num-rows-${componentKey}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={readText(properties.numRows, "fixed")}
            onChange={(event) => changeProperty("numRows", event.target.value)}
          >
            <option value="fixed">Edit existing rows</option>
            <option value="dynamic">Allow adding and deleting rows</option>
          </select>
        </div>
      )}
      <DataWindowTableBindingEditor
        componentKey={componentKey}
        bindings={bindings}
        disabled={disabled}
        primaryKeyRequired={editable}
        onBindingsChange={onBindingsChange}
      />
      <div className="grid gap-2">
        <Label htmlFor={`data-window-width-${componentKey}`}>Width</Label>
        <select
          id={`data-window-width-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={dimensionMode(properties.width, "stretch")}
          onChange={(event) => changeProperty(
            "width",
            readDimensionSelection(event.target.value, properties.width),
          )}
        >
          <option value="stretch">Stretch</option>
          <option value="content">Content</option>
          <option value="custom">Fixed pixels</option>
        </select>
        {typeof properties.width === "number" && (
          <Input
            aria-label="Fixed width in pixels"
            type="number"
            min={1}
            max={4000}
            value={properties.width}
            onChange={(event) => changeProperty("width", readInputNumber(event.target.value))}
          />
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-height-${componentKey}`}>Height</Label>
        <select
          id={`data-window-height-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={dimensionMode(properties.height, "auto")}
          onChange={(event) => changeProperty(
            "height",
            readDimensionSelection(event.target.value, properties.height),
          )}
        >
          <option value="auto">Auto</option>
          <option value="content">Content</option>
          <option value="stretch">Stretch</option>
          <option value="custom">Fixed pixels</option>
        </select>
        {typeof properties.height === "number" && (
          <Input
            aria-label="Fixed height in pixels"
            type="number"
            min={1}
            max={10000}
            value={properties.height}
            onChange={(event) => changeProperty("height", readInputNumber(event.target.value))}
          />
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-hide-index-${componentKey}`}>Hide index</Label>
        <select
          id={`data-window-hide-index-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={properties.hideIndex === true ? "true" : properties.hideIndex === false ? "false" : "none"}
          onChange={(event) => changeProperty(
            "hideIndex",
            event.target.value === "none" ? null : event.target.value === "true",
          )}
        >
          <option value="none">Automatic</option>
          <option value="true">Hide</option>
          <option value="false">Show</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-placeholder-${componentKey}`}>Missing-value placeholder</Label>
        <Input
          id={`data-window-placeholder-${componentKey}`}
          maxLength={2000}
          value={readText(properties.placeholder, "")}
          onChange={(event) => changeProperty("placeholder", event.target.value || null)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={readBoolean(properties.scrollable, true)}
          onChange={(event) => changeProperty("scrollable", event.target.checked)}
        />
        Enable table scrolling
      </label>
      {editable && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={readBoolean(properties.disabled, false)}
            onChange={(event) => changeProperty("disabled", event.target.checked)}
          />
          Disable editing
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Data queries run with the current viewer’s SQL permissions. An existing SQL warehouse must be bound to each generated app.
      </p>
      {editable && (
        <p className="text-xs text-muted-foreground">
          Saves require a Delta table, a unique non-null primary key, and the current viewer’s MODIFY permission. Save up to 500 changed rows at a time.
        </p>
      )}
    </fieldset>
  );
}

function dimensionMode(value: unknown, defaultMode: string): string {
  return typeof value === "number" ? "custom" : typeof value === "string" ? value : defaultMode;
}

function readDimensionSelection(value: string, currentValue: unknown): string | number {
  if (value === "custom") {
    return typeof currentValue === "number" ? currentValue : 800;
  }

  return value;
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

function readNumber(value: unknown, defaultValue: number): number {
  return typeof value === "number" ? value : defaultValue;
}

function readInputNumber(value: string): number {
  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) ? parsedValue : 0;
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

export default DataWindowPropertiesEditor;
