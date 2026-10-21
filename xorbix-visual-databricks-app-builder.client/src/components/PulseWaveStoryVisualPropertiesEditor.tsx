import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IPulseWaveStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const VISUAL_SETTINGS = [
  { name: "showBaseline", label: "Show baseline", fallback: true },
  { name: "showEvents", label: "Show events", fallback: true },
  { name: "showAnomalyMarkers", label: "Show anomaly markers", fallback: true },
  { name: "fillUnderWave", label: "Fill under wave", fallback: true },
] as const;

function PulseWaveStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IPulseWaveStoryVisualPropertiesEditorProps>) {
  function change(name: string, value: boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Pulse wave appearance</legend>
      <div className="grid gap-2">
        <Label htmlFor={`pulse-wave-aggregation-${componentKey}`}>Metric aggregation default</Label>
        <select
          id={`pulse-wave-aggregation-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeof properties.aggregationMethod === "string" ? properties.aggregationMethod : "sum"}
          onChange={(event) => onPropertiesChange({ ...properties, aggregationMethod: event.target.value })}
        >
          <option value="sum">Sum</option>
          <option value="avg">Average</option>
          <option value="max">Maximum</option>
          <option value="min">Minimum</option>
        </select>
      </div>
      {VISUAL_SETTINGS.map((setting) => {
        const id = `pulse-wave-${setting.name}-${componentKey}`;
        return (
          <div key={setting.name} className="flex items-center gap-2">
            <input
              id={id}
              type="checkbox"
              checked={typeof properties[setting.name] === "boolean" ? properties[setting.name] as boolean : setting.fallback}
              onChange={(event) => change(setting.name, event.target.checked)}
            />
            <Label htmlFor={id}>{setting.label}</Label>
          </div>
        );
      })}
    </fieldset>
  );
}

export default PulseWaveStoryVisualPropertiesEditor;
