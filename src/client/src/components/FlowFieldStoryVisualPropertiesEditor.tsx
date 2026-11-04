import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IFlowFieldStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

function FlowFieldStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IFlowFieldStoryVisualPropertiesEditorProps>) {
  function change(name: "showDropOffs" | "showLabels", value: boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Flow field appearance</legend>
      {[
        { name: "showDropOffs" as const, label: "Show drop-offs", fallback: true },
        { name: "showLabels" as const, label: "Show labels", fallback: true },
      ].map((setting) => (
        <div key={setting.name} className="flex items-center gap-2">
          <input
            id={`flow-field-${setting.name}-${componentKey}`}
            type="checkbox"
            checked={typeof properties[setting.name] === "boolean" ? properties[setting.name] as boolean : setting.fallback}
            onChange={(event) => change(setting.name, event.target.checked)}
          />
          <Label htmlFor={`flow-field-${setting.name}-${componentKey}`}>{setting.label}</Label>
        </div>
      ))}
    </fieldset>
  );
}

export default FlowFieldStoryVisualPropertiesEditor;
