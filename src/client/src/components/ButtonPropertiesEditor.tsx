import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IButtonPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function ButtonPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<IButtonPropertiesEditorProps>) {
  const labelId = `button-label-${componentKey}`;
  const variantId = `button-variant-${componentKey}`;
  const helpId = `button-help-${componentKey}`;
  const disabledId = `button-disabled-${componentKey}`;
  const variant = properties.variant === "secondary" ? "secondary" : "primary";

  function changeProperty(propertyName: string, value: string | boolean) {
    onChange({ ...properties, [propertyName]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Button properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label, "Click Me")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={variantId}>Variant</Label>
        <Select
          value={variant}
          onValueChange={(value) => changeProperty("variant", value)}
        >
          <SelectTrigger id={variantId} aria-label="Button variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
          </SelectContent>
        </Select>
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
      <div className="flex items-center gap-3">
        <Switch
          id={disabledId}
          checked={properties.disabled === true}
          onCheckedChange={(checked) => changeProperty("disabled", checked)}
        />
        <Label htmlFor={disabledId}>Disabled</Label>
      </div>
    </fieldset>
  );
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

export default ButtonPropertiesEditor;
