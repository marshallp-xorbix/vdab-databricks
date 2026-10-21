import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type {
  ProjectJsonObject,
  ProjectJsonValue,
} from "../models/ProjectComponents";

interface ILabelPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

const LABEL_FONT_SIZES = ["small", "medium", "large"] as const;

function LabelPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<ILabelPropertiesEditorProps>) {
  const textId = `label-text-${componentKey}`;
  const fontSizeId = `label-font-size-${componentKey}`;
  const boldId = `label-bold-${componentKey}`;

  function changeProperty(propertyName: string, value: ProjectJsonValue) {
    onChange({ ...properties, [propertyName]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Label properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={textId}>Text</Label>
        <Textarea
          id={textId}
          name="text"
          maxLength={5000}
          value={readText(properties.text, "Label Text")}
          onChange={(event) => changeProperty("text", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={fontSizeId}>Font size</Label>
        <select
          id={fontSizeId}
          name="fontSize"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={readFontSize(properties.fontSize)}
          onChange={(event) => changeProperty("fontSize", event.target.value)}
        >
          {LABEL_FONT_SIZES.map((fontSize) => (
            <option key={fontSize} value={fontSize}>{fontSize}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={boldId}
          checked={properties.bold === true}
          onCheckedChange={(checked) => changeProperty("bold", checked)}
        />
        <Label htmlFor={boldId}>Bold</Label>
      </div>
    </fieldset>
  );
}

function readText(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}

function readFontSize(value: unknown): (typeof LABEL_FONT_SIZES)[number] {
  return value === "small" || value === "large" ? value : "medium";
}

export default LabelPropertiesEditor;
