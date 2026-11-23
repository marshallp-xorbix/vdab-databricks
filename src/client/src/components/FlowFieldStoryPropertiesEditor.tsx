import { Input } from "./ui/input";
import { Label } from "./ui/label";
import FlowFieldStoryVisualPropertiesEditor from "./FlowFieldStoryVisualPropertiesEditor";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IFlowFieldStoryPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function FlowFieldStoryPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<IFlowFieldStoryPropertiesEditorProps>) {
  const title = typeof properties.title === "string" ? properties.title : "Flow Field Story";

  return (
    <section className="grid gap-4" aria-label="Flow field story configuration">
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Flow field story properties</legend>
        <div className="grid gap-2">
          <Label htmlFor={`flow-field-title-${componentKey}`}>Title</Label>
          <Input
            id={`flow-field-title-${componentKey}`}
            maxLength={500}
            value={title}
            onChange={(event) => onPropertiesChange({ ...properties, title: event.target.value })}
          />
        </div>
      </fieldset>
      <FlowFieldStoryVisualPropertiesEditor
        componentKey={componentKey}
        properties={properties}
        disabled={disabled}
        onPropertiesChange={onPropertiesChange}
      />
    </section>
  );
}

export default FlowFieldStoryPropertiesEditor;
