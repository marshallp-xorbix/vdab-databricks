import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type {
  ProjectJsonObject,
  ProjectJsonValue,
} from "../models/ProjectComponents";

interface ISliderPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

const DEFAULT_SLIDER_VALUES = {
  minValue: 0,
  maxValue: 100,
  defaultValue: 50,
  upperValue: 60,
  step: 1,
} as const;

function SliderPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<ISliderPropertiesEditorProps>) {
  const ranged = properties.ranged === true;
  const labelId = `slider-label-${componentKey}`;
  const helpId = `slider-help-${componentKey}`;
  const disabledId = `slider-disabled-${componentKey}`;
  const rangedId = `slider-ranged-${componentKey}`;

  function changeProperty(propertyName: string, value: ProjectJsonValue) {
    onChange({ ...properties, [propertyName]: value });
  }

  function renderNumberField(
    propertyName: "minValue" | "maxValue" | "defaultValue" | "upperValue" | "step",
    label: string,
    defaultValue: number,
  ) {
    const inputId = `slider-${propertyName}-${componentKey}`;
    const value = readNumber(properties[propertyName], defaultValue);

    return (
      <div className="grid gap-2" key={propertyName}>
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          name={propertyName}
          type="number"
          step="any"
          value={value}
          onChange={(event) =>
            changeProperty(
              propertyName,
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      </div>
    );
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Slider properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label, "Slider")}
          onChange={(event) => changeProperty("label", event.target.value)}
        />
      </div>
      {renderNumberField("minValue", "Minimum value", DEFAULT_SLIDER_VALUES.minValue)}
      {renderNumberField("maxValue", "Maximum value", DEFAULT_SLIDER_VALUES.maxValue)}
      {renderNumberField(
        "defaultValue",
        ranged ? "Lower value" : "Default value",
        DEFAULT_SLIDER_VALUES.defaultValue,
      )}
      {ranged && renderNumberField("upperValue", "Upper value", DEFAULT_SLIDER_VALUES.upperValue)}
      {renderNumberField("step", "Step", DEFAULT_SLIDER_VALUES.step)}
      <div className="grid gap-2">
        <Label htmlFor={`slider-format-${componentKey}`}>Display format</Label>
        <Input
          id={`slider-format-${componentKey}`}
          name="format"
          maxLength={40}
          placeholder="plain or %.2f"
          value={readText(properties.format, "")}
          onChange={(event) => changeProperty("format", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Use a Streamlit format name or a numeric format such as %.2f.
        </p>
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
          id={rangedId}
          checked={ranged}
          onCheckedChange={(checked) => changeProperty("ranged", checked)}
        />
        <Label htmlFor={rangedId}>Select a range</Label>
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

function readNumber(value: unknown, defaultValue: number): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
}

export default SliderPropertiesEditor;
