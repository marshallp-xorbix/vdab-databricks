import { useEffect, useState } from "react";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface ITerrainStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const SELECT_SETTINGS = [
  { name: "terrainMode", label: "Terrain mode", fallback: "surface", options: [
    ["surface", "Surface (3D mesh)"], ["heat_surface", "Heat surface"], ["ridge", "Ridge (isometric)"],
  ] },
  { name: "aggregationMethod", label: "Height fallback aggregation", fallback: "sum", options: [
    ["sum", "Sum"], ["avg", "Average"], ["max", "Maximum"], ["min", "Minimum"],
  ] },
  { name: "interpolation", label: "Interpolation", fallback: "bilinear", options: [
    ["none", "None"], ["bilinear", "Bilinear"],
  ] },
  { name: "colorBy", label: "Color by", fallback: "height_metric", options: [
    ["height_metric", "Height"], ["risk_score", "Risk score"], ["variance", "Variance"], ["category", "Category"],
  ] },
  { name: "cameraPreset", label: "Camera preset", fallback: "angled", options: [
    ["front", "Front"], ["angled", "Angled"], ["top", "Top"], ["free", "Free"],
  ] },
] as const;
const NUMBER_SETTINGS = [
  { name: "heightScale", label: "Height scale", fallback: 1, minimum: 0.1, maximum: 5, step: 0.1, integer: false },
  { name: "gridResolution", label: "Grid resolution", fallback: 60, minimum: 10, maximum: 120, step: 5, integer: true },
] as const;
const BOOLEAN_SETTINGS = [
  { name: "showPeakLabels", label: "Show peak labels", fallback: true },
  { name: "showValleyLabels", label: "Show valley labels", fallback: true },
] as const;

function TerrainStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<ITerrainStoryVisualPropertiesEditorProps>) {
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setNumberDrafts({});
  }, [properties.heightScale, properties.gridResolution]);

  function change(name: string, value: string | number | boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  function commitNumber(setting: (typeof NUMBER_SETTINGS)[number]) {
    const draft = numberDrafts[setting.name];
    if (draft === undefined) return;
    const nextValue = Number(draft);
    if (
      Number.isFinite(nextValue) && nextValue >= setting.minimum && nextValue <= setting.maximum &&
      (!setting.integer || Number.isInteger(nextValue))
    ) {
      change(setting.name, nextValue);
    }
    setNumberDrafts((current) => {
      const remaining = { ...current };
      delete remaining[setting.name];
      return remaining;
    });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Terrain story appearance</legend>
      {SELECT_SETTINGS.map((setting) => {
        const id = `terrain-${setting.name}-${componentKey}`;
        const value = typeof properties[setting.name] === "string" ? properties[setting.name] as string : setting.fallback;
        return (
          <div key={setting.name} className="grid gap-2">
            <Label htmlFor={id}>{setting.label}</Label>
            <select
              id={id}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={value}
              onChange={(event) => change(setting.name, event.target.value)}
            >
              {setting.options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
            </select>
          </div>
        );
      })}
      {NUMBER_SETTINGS.map((setting) => {
        const id = `terrain-${setting.name}-${componentKey}`;
        const value = numberDrafts[setting.name] ?? (
          typeof properties[setting.name] === "number" ? String(properties[setting.name]) : String(setting.fallback)
        );
        return (
          <div key={setting.name} className="grid gap-2">
            <Label htmlFor={id}>{setting.label}</Label>
            <input
              id={id}
              type="number"
              min={setting.minimum}
              max={setting.maximum}
              step={setting.step}
              value={value}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setNumberDrafts((current) => ({ ...current, [setting.name]: nextValue }));
              }}
              onBlur={() => commitNumber(setting)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        );
      })}
      {BOOLEAN_SETTINGS.map((setting) => {
        const id = `terrain-${setting.name}-${componentKey}`;
        const checked = typeof properties[setting.name] === "boolean" ? properties[setting.name] as boolean : setting.fallback;
        return (
          <div key={setting.name} className="flex items-center gap-2">
            <input id={id} type="checkbox" checked={checked} onChange={(event) => change(setting.name, event.target.checked)} />
            <Label htmlFor={id}>{setting.label}</Label>
          </div>
        );
      })}
    </fieldset>
  );
}

export default TerrainStoryVisualPropertiesEditor;
