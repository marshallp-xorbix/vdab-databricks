import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IHoneycombStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

function HoneycombStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IHoneycombStoryVisualPropertiesEditorProps>) {
  function change(name: string, value: boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Honeycomb appearance</legend>
      {[
        { name: "showLabels", label: "Show item labels", fallback: true },
        { name: "showRiskBorders", label: "Highlight high-risk borders", fallback: true },
        { name: "showTrendArrows", label: "Show trend arrows", fallback: true },
      ].map((setting) => (
        <div key={setting.name} className="flex items-center gap-2">
          <input
            id={`honeycomb-${setting.name}-${componentKey}`}
            type="checkbox"
            checked={typeof properties[setting.name] === "boolean" ? properties[setting.name] as boolean : setting.fallback}
            onChange={(event) => change(setting.name, event.target.checked)}
          />
          <Label htmlFor={`honeycomb-${setting.name}-${componentKey}`}>{setting.label}</Label>
        </div>
      ))}
    </fieldset>
  );
}

export default HoneycombStoryVisualPropertiesEditor;
