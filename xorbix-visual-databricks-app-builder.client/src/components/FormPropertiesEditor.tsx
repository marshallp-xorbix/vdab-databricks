import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  FORM_CHILD_TYPES,
  type FormChildComponentType,
} from "../utils/projectComponentFactory";

const MAX_FORM_DIMENSION_PIXELS = 10_000;

interface IFormPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childCount: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onAddChild: (type: FormChildComponentType) => void;
}

function FormPropertiesEditor({
  componentKey,
  properties,
  childCount,
  disabled,
  onChange,
  onAddChild,
}: Readonly<IFormPropertiesEditorProps>) {
  const [childType, setChildType] = useState<FormChildComponentType>("TextInput");
  const prefix = `form-${componentKey}`;
  const widthMode = readDimensionMode(properties.width, "stretch", "content");
  const heightMode = readDimensionMode(properties.height, "content", "stretch");

  function changeProperty(property: string, value: string | number | boolean) {
    onChange({ ...properties, [property]: value });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Form properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-submit-label`}>Submit button label</Label>
        <Input
          id={`${prefix}-submit-label`}
          name="submitButtonText"
          maxLength={2000}
          value={readText(properties.submitButtonText, "Submit")}
          onChange={(event) => changeProperty("submitButtonText", event.target.value)}
        />
      </div>
      <FormToggle
        id={`${prefix}-clear-on-submit`}
        label="Clear values after submit"
        checked={readBoolean(properties.clearOnSubmit, false)}
        onChange={(checked) => changeProperty("clearOnSubmit", checked)}
      />
      <FormToggle
        id={`${prefix}-enter-to-submit`}
        label="Allow Enter to submit"
        checked={readBoolean(properties.enterToSubmit, true)}
        onChange={(checked) => changeProperty("enterToSubmit", checked)}
      />
      <FormToggle
        id={`${prefix}-border`}
        label="Show form border"
        checked={readBoolean(properties.border, true)}
        onChange={(checked) => changeProperty("border", checked)}
      />
      <FormDimensionEditor
        id={`${prefix}-width`}
        label="Form width"
        value={widthMode}
        pixels={readPixels(properties.width)}
        modes={["stretch", "content"]}
        onModeChange={(mode) => changeProperty(
          "width",
          mode === "custom" ? readPixels(properties.width) : mode,
        )}
        onPixelsChange={(pixels) => changeProperty("width", pixels)}
      />
      <FormDimensionEditor
        id={`${prefix}-height`}
        label="Form height"
        value={heightMode}
        pixels={readPixels(properties.height)}
        modes={["content", "stretch"]}
        onModeChange={(mode) => changeProperty(
          "height",
          mode === "custom" ? readPixels(properties.height) : mode,
        )}
        onPixelsChange={(pixels) => changeProperty("height", pixels)}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-child-type`}>Form control type</Label>
        <select
          id={`${prefix}-child-type`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={childType}
          onChange={(event) => setChildType(event.target.value as FormChildComponentType)}
        >
          {FORM_CHILD_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => onAddChild(childType)}>
          Add form control
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {childCount === 1 ? "1 form control" : `${childCount} form controls`} in order
        </p>
      </div>
    </fieldset>
  );
}

interface IFormToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FormToggle({ id, label, checked, onChange }: Readonly<IFormToggleProps>) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

interface IFormDimensionEditorProps {
  id: string;
  label: string;
  value: "stretch" | "content" | "custom";
  pixels: number;
  modes: readonly ("stretch" | "content")[];
  onModeChange: (mode: "stretch" | "content" | "custom") => void;
  onPixelsChange: (pixels: number) => void;
}

function FormDimensionEditor({
  id,
  label,
  value,
  pixels,
  modes,
  onModeChange,
  onPixelsChange,
}: Readonly<IFormDimensionEditorProps>) {
  const [pixelText, setPixelText] = useState(String(pixels));

  useEffect(() => {
    setPixelText(String(pixels));
  }, [pixels]);

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-mode`}>{label}</Label>
      <select
        id={`${id}-mode`}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onModeChange(event.target.value as "stretch" | "content" | "custom")}
      >
        {modes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        <option value="custom">Custom pixels</option>
      </select>
      {value === "custom" && (
        <Input
          aria-label={`${label} in pixels`}
          type="number"
          min={1}
          max={MAX_FORM_DIMENSION_PIXELS}
          step={1}
          value={pixelText}
          onChange={(event) => {
            setPixelText(event.target.value);
            if (event.target.value !== "") {
              onPixelsChange(Number(event.target.value));
            }
          }}
        />
      )}
    </div>
  );
}

function readDimensionMode(
  value: unknown,
  defaultMode: "stretch" | "content",
  alternativeMode: "stretch" | "content",
): "stretch" | "content" | "custom" {
  if (value === undefined || value === null) {
    return defaultMode;
  }

  return value === defaultMode || value === alternativeMode ? value : "custom";
}

function readPixels(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 720;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export default FormPropertiesEditor;
