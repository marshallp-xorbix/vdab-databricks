import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface ISpiralStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const SETTINGS = [
  { name: "showLabels", label: "Show milestone labels", fallback: true },
  { name: "showRiskGlow", label: "Show high-risk glow", fallback: true },
  { name: "showVariance", label: "Show schedule variance", fallback: true },
  { name: "spaceByTimeline", label: "Space milestones by timeline", fallback: false },
] as const;

function SpiralStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<ISpiralStoryVisualPropertiesEditorProps>) {
  function change(name: string, value: boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Spiral story appearance</legend>
      {SETTINGS.map((setting) => {
        const id = `spiral-${setting.name}-${componentKey}`;
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

export default SpiralStoryVisualPropertiesEditor;
