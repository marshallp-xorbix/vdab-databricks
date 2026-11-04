import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface ITextInputPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function TextInputPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<ITextInputPropertiesEditorProps>) {
  const labelId = `text-input-label-${componentKey}`;
  const placeholderId = `text-input-placeholder-${componentKey}`;
  const defaultValueId = `text-input-default-${componentKey}`;
  const helpId = `text-input-help-${componentKey}`;
  const disabledId = `text-input-disabled-${componentKey}`;
  const multilineId = `text-input-multiline-${componentKey}`;
  const typeId = `text-input-type-${componentKey}`;
  const heightId = `text-input-height-${componentKey}`;
  const multiline = properties.multiline === true;
  const inputType = properties.type === "password" ? "password" : "default";

  function changeProperty(propertyName: string, value: string | boolean) {
    onChange({ ...properties, [propertyName]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Text input properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label, "Label")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={placeholderId}>Placeholder</Label>
        <Input
          id={placeholderId}
          name="placeholder"
          maxLength={2000}
          value={readText(properties.placeholder, "")}
          onChange={(event) => changeProperty("placeholder", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={defaultValueId}>Default value</Label>
        <Textarea
          id={defaultValueId}
          name="defaultValue"
          maxLength={10000}
          value={readText(properties.defaultValue, "")}
          onChange={(event) => changeProperty("defaultValue", event.target.value)}
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
            id={disabledId}
            checked={properties.disabled === true}
            onCheckedChange={(checked) => changeProperty("disabled", checked)}
          />
          <Label htmlFor={disabledId}>Disabled</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={multilineId}
            checked={multiline}
            onCheckedChange={(checked) => changeProperty("multiline", checked)}
          />
          <Label htmlFor={multilineId}>Multiline</Label>
        </div>
      </div>
      {multiline ? (
        <div className="grid gap-2">
          <Label htmlFor={heightId}>Height</Label>
          <Input
            id={heightId}
            name="height"
            inputMode="numeric"
            maxLength={10}
            value={readText(properties.height, "")}
            onChange={(event) => changeProperty("height", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Values above 98 are emitted as pixel heights.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={typeId}>Input type</Label>
          <Select
            value={inputType}
            onValueChange={(value) => changeProperty("type", value)}
          >
            <SelectTrigger id={typeId} aria-label="Input type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Text</SelectItem>
              <SelectItem value="password">Password</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </fieldset>
  );
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

export default TextInputPropertiesEditor;
