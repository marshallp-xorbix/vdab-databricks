import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IDropdownPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function DropdownPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<IDropdownPropertiesEditorProps>) {
  const labelId = `dropdown-label-${componentKey}`;
  const optionsId = `dropdown-options-${componentKey}`;
  const defaultValueId = `dropdown-default-${componentKey}`;
  const placeholderId = `dropdown-placeholder-${componentKey}`;
  const helpId = `dropdown-help-${componentKey}`;
  const disabledId = `dropdown-disabled-${componentKey}`;
  const multiselectId = `dropdown-multiselect-${componentKey}`;
  const options = readOptions(properties.options);
  const optionValues = options.map((option) => option.value);
  const multiselect = properties.multiselect === true;
  const noSelectionValue = createNoSelectionValue(componentKey);
  const rawDefaultValue = readText(properties.defaultValue, "");
  const defaultOptionIndex = optionValues.indexOf(rawDefaultValue);
  const defaultValue = multiselect
    ? defaultOptionIndex < 0 ? noSelectionValue : String(defaultOptionIndex)
    : String(Math.max(defaultOptionIndex, 0));

  function changeProperty(propertyName: string, value: string | boolean) {
    onChange({ ...properties, [propertyName]: value });
  }

  function changeOptions(value: string) {
    const nextOptions = parseOptions(value);
    const nextOptionValues = nextOptions.map((option) => option.value);
    const currentDefaultValue = readText(properties.defaultValue, "");
    const nextDefaultValue = nextOptionValues.includes(currentDefaultValue)
      ? currentDefaultValue
      : properties.multiselect === true ? "" : nextOptionValues[0] ?? "";

    onChange({
      ...properties,
      options: nextOptions,
      defaultValue: nextDefaultValue,
    });
  }

  function changeDefaultOption(value: string) {
    if (value === noSelectionValue) {
      changeProperty("defaultValue", "");
      return;
    }

    const optionIndex = Number.parseInt(value, 10);
    const option = options[optionIndex];
    if (option) {
      changeProperty("defaultValue", option.value);
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Dropdown properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label, "Select an option")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={optionsId}>Options (one per line)</Label>
        <Textarea
          id={optionsId}
          name="options"
          rows={5}
          maxLength={10_000}
          value={options.map((option) => option.value).join("\n")}
          onChange={(event) => changeOptions(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Each non-empty line becomes an option.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={defaultValueId}>Default option</Label>
        {options.length > 0 ? (
          <Select
            value={defaultValue}
            onValueChange={changeDefaultOption}
          >
            <SelectTrigger id={defaultValueId} aria-label="Default option">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {multiselect && (
                <SelectItem value={noSelectionValue}>No default selection</SelectItem>
              )}
              {options.map((option, index) => (
                <SelectItem key={index} value={String(index)}>
                  {option.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p role="status" className="rounded-md border border-border p-3 text-sm">
            Add at least one option to choose a default.
          </p>
        )}
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
            id={multiselectId}
            checked={multiselect}
            onCheckedChange={(checked) => changeProperty("multiselect", checked)}
          />
          <Label htmlFor={multiselectId}>Allow multiple selections</Label>
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

function readOptions(value: unknown): Array<{ value: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isDropdownOption);
}

function isDropdownOption(value: unknown): value is { value: string } {
  return typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof value.value === "string";
}

function parseOptions(value: string): Array<{ value: string }> {
  return value.split(/\r?\n/)
    .filter((option) => option.length > 0)
    .map((option) => ({ value: option }));
}

function createNoSelectionValue(componentKey: string): string {
  return `__vdab_no_default_${componentKey}__`;
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

export default DropdownPropertiesEditor;
