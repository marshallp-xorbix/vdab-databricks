import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IBooleanControlPropertiesEditorProps {
  componentKey: string;
  componentType: "Checkbox" | "Toggle";
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function BooleanControlPropertiesEditor({
  componentKey,
  componentType,
  properties,
  disabled,
  onChange,
}: Readonly<IBooleanControlPropertiesEditorProps>) {
  const labelId = `boolean-control-label-${componentKey}`;
  const helpId = `boolean-control-help-${componentKey}`;
  const initialValueId = `boolean-control-initial-value-${componentKey}`;
  const disabledId = `boolean-control-disabled-${componentKey}`;
  const defaultPropertyName = componentType === "Checkbox"
    ? "defaultChecked"
    : "defaultValue";
  const defaultValueLabel = componentType === "Checkbox"
    ? "Checked by default"
    : "On by default";
  const defaultLabel = componentType;

  function changeProperty(propertyName: string, value: string | boolean) {
    onChange({ ...properties, [propertyName]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{componentType} properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label, defaultLabel)}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={helpId}>Help text</Label>
        <Textarea
          id={helpId}
          name="help"
          maxLength={2000}
          value={readText(properties.help, "")}
          onChange={(event) => changeProperty("help", event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Switch
            id={initialValueId}
            checked={properties[defaultPropertyName] === true}
            onCheckedChange={(checked) => changeProperty(defaultPropertyName, checked)}
          />
          <Label htmlFor={initialValueId}>{defaultValueLabel}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={disabledId}
            checked={properties.disabled === true}
            onCheckedChange={(checked) => changeProperty("disabled", checked)}
          />
          <Label htmlFor={disabledId}>Disabled</Label>
        </div>
      </div>
    </fieldset>
  );
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

export default BooleanControlPropertiesEditor;
