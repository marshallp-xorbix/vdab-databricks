import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type {
  ProjectJsonObject,
  ProjectJsonValue,
} from "../models/ProjectComponents";

interface IDateTimeControlPropertiesEditorProps {
  componentKey: string;
  componentType: "DatePicker" | "TimePicker";
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function DateTimeControlPropertiesEditor({
  componentKey,
  componentType,
  properties,
  disabled,
  onChange,
}: Readonly<IDateTimeControlPropertiesEditorProps>) {
  const labelId = `date-time-label-${componentKey}`;
  const defaultValueId = `date-time-default-${componentKey}`;
  const helpId = `date-time-help-${componentKey}`;
  const disabledId = `date-time-disabled-${componentKey}`;
  const defaultValueLabel = componentType === "DatePicker" ? "Default date" : "Default time";
  const defaultValueHint = componentType === "DatePicker"
    ? 'Use "today" or a date in YYYY-MM-DD format.'
    : 'Use "now" or a time in HH:MM[:SS] format.';
  const defaultValue = readText(
    properties.defaultValue,
    componentType === "DatePicker" ? "today" : "now",
  );

  function changeProperty(propertyName: string, value: ProjectJsonValue) {
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
          value={readText(properties.label, componentType === "DatePicker" ? "Select Date" : "Select Time")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={defaultValueId}>{defaultValueLabel}</Label>
        <Input
          id={defaultValueId}
          name="defaultValue"
          maxLength={40}
          value={defaultValue}
          onChange={(event) => changeProperty("defaultValue", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{defaultValueHint}</p>
      </div>
      {componentType === "DatePicker" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`date-time-min-${componentKey}`}>Minimum date</Label>
            <Input
              id={`date-time-min-${componentKey}`}
              name="minDate"
              type="date"
              value={readText(properties.minDate, "")}
              onChange={(event) => changeProperty("minDate", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`date-time-max-${componentKey}`}>Maximum date</Label>
            <Input
              id={`date-time-max-${componentKey}`}
              name="maxDate"
              type="date"
              value={readText(properties.maxDate, "")}
              onChange={(event) => changeProperty("maxDate", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`date-time-format-${componentKey}`}>Date format</Label>
            <Input
              id={`date-time-format-${componentKey}`}
              name="format"
              placeholder="YYYY/MM/DD"
              value={readText(properties.format, "")}
              onChange={(event) => changeProperty("format", event.target.value)}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={`date-time-step-${componentKey}`}>Step in seconds</Label>
          <Input
            id={`date-time-step-${componentKey}`}
            name="step"
            type="number"
            min={1}
            max={82_800}
            step={1}
            value={readNumberText(properties.step)}
            onChange={(event) =>
              changeProperty(
                "step",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Enter a whole number from 1 through 82,800 seconds.
          </p>
        </div>
      )}
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

function readNumberText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export default DateTimeControlPropertiesEditor;
