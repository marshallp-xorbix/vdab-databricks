import { Input } from "./ui/input";
import { Label } from "./ui/label";
import NetworkWebStoryVisualPropertiesEditor from "./NetworkWebStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface INetworkWebStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function NetworkWebStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<INetworkWebStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Network Web Story";

  return (
    <section className="grid gap-4" aria-label="Network web story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Network web story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`network-web-title-${componentKey}`}>Title</Label>
          <Input
            id={`network-web-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <NetworkWebStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default NetworkWebStoryPropertiesEditor;
