import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IAmoebaStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

interface ISelectSetting {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

const SELECT_SETTINGS: ISelectSetting[] = [
  { name: "layoutMode", label: "Layout", options: [{ value: "hybrid", label: "Hybrid" }, { value: "scatter", label: "Scatter" }, { value: "cluster", label: "Cluster" }] },
  { name: "sizeScale", label: "Size scale", options: [{ value: "linear", label: "Linear" }, { value: "sqrt", label: "Square root" }, { value: "log", label: "Logarithmic" }] },
  { name: "colorBy", label: "Color by", options: [{ value: "category", label: "Category" }, { value: "health_score", label: "Health score" }] },
  { name: "pulseBy", label: "Pulse by", options: [{ value: "risk_score", label: "Risk score" }, { value: "none", label: "None" }] },
  { name: "pulseThresholdMode", label: "Pulse threshold direction", options: [{ value: "above", label: "At or above" }, { value: "below", label: "At or below" }] },
  { name: "labelMode", label: "Labels", options: [{ value: "none", label: "None" }, { value: "compact", label: "Compact" }, { value: "full", label: "Full" }] },
  { name: "animationEnabled", label: "Animation", options: [{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }] },
];

interface INumericSetting {
  name: string;
  label: string;
  minimum: number;
  maximum: number;
  step: number;
  fallback: number;
}

const NUMERIC_SETTINGS: INumericSetting[] = [
  { name: "minRadiusPx", label: "Minimum radius (px)", minimum: 8, maximum: 200, step: 1, fallback: 42 },
  { name: "maxRadiusPx", label: "Maximum radius (px)", minimum: 16, maximum: 300, step: 1, fallback: 130 },
  { name: "pulseThreshold", label: "Pulse threshold", minimum: 0, maximum: 100, step: 1, fallback: 50 },
  { name: "shapeVariation", label: "Shape variation", minimum: 0, maximum: 1, step: 0.05, fallback: 0.35 },
  { name: "animationSpeed", label: "Animation speed", minimum: 0.25, maximum: 3, step: 0.25, fallback: 1 },
];

function AmoebaStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IAmoebaStoryVisualPropertiesEditorProps>) {
  function change(name: string, value: string | number | boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Amoeba story appearance and behavior</legend>
      {SELECT_SETTINGS.map((setting) => (
        <div key={setting.name} className="grid gap-2">
          <Label htmlFor={`amoeba-${setting.name}-${componentKey}`}>{setting.label}</Label>
          <select
            id={`amoeba-${setting.name}-${componentKey}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={String(properties[setting.name] ?? setting.options[0]?.value ?? "")}
            onChange={(event) => change(
              setting.name,
              setting.name === "animationEnabled" ? event.target.value === "true" : event.target.value,
            )}
          >
            {setting.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      ))}
      {NUMERIC_SETTINGS.map((setting) => (
        <div key={setting.name} className="grid gap-2">
          <Label htmlFor={`amoeba-${setting.name}-${componentKey}`}>{setting.label}</Label>
          <Input
            id={`amoeba-${setting.name}-${componentKey}`}
            type="number"
            min={setting.minimum}
            max={setting.maximum}
            step={setting.step}
            value={readNumber(properties[setting.name], setting.fallback)}
            onChange={(event) => change(setting.name, event.target.value === "" ? setting.fallback : Number(event.target.value))}
          />
        </div>
      ))}
      <p role="note" className="text-xs text-muted-foreground">
        Minimum radius must be less than or equal to maximum radius. Risk pulse needs a mapped risk score.
      </p>
    </fieldset>
  );
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default AmoebaStoryVisualPropertiesEditor;
