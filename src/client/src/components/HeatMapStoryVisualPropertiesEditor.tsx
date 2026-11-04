import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IHeatMapStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

function HeatMapStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IHeatMapStoryVisualPropertiesEditorProps>) {
  function change(name: string, value: string | boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Heat map appearance</legend>
      <p className="text-sm text-muted-foreground">Map scope: USA · Geographic level: State</p>
      <div className="grid gap-2">
        <Label htmlFor={`heat-map-aggregation-${componentKey}`}>Default aggregation</Label>
        <select
          id={`heat-map-aggregation-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeof properties.aggregationMethod === "string" ? properties.aggregationMethod : "sum"}
          onChange={(event) => change("aggregationMethod", event.target.value)}
        >
          <option value="sum">Sum</option>
          <option value="avg">Average</option>
          <option value="max">Maximum</option>
          <option value="min">Minimum</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`heat-map-scale-${componentKey}`}>Color scale</Label>
        <select
          id={`heat-map-scale-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={properties.colorScale === "diverging" ? "diverging" : "sequential"}
          onChange={(event) => change("colorScale", event.target.value)}
        >
          <option value="sequential">Sequential</option>
          <option value="diverging">Diverging</option>
        </select>
      </div>
      {[
        { name: "showLabels", label: "Show state labels", fallback: true },
        { name: "showLegend", label: "Show metric legend", fallback: true },
      ].map((setting) => (
        <div key={setting.name} className="flex items-center gap-2">
          <input
            id={`heat-map-${setting.name}-${componentKey}`}
            type="checkbox"
            checked={typeof properties[setting.name] === "boolean" ? properties[setting.name] as boolean : setting.fallback}
            onChange={(event) => change(setting.name, event.target.checked)}
          />
          <Label htmlFor={`heat-map-${setting.name}-${componentKey}`}>{setting.label}</Label>
        </div>
      ))}
    </fieldset>
  );
}

export default HeatMapStoryVisualPropertiesEditor;
