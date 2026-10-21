import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  MODAL_CHILD_TYPES,
  type ModalChildComponentType,
} from "../utils/projectComponentFactory";

interface IModalPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childCount: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onAddChild: (type: ModalChildComponentType) => void;
}

function ModalPropertiesEditor({
  componentKey,
  properties,
  childCount,
  disabled,
  onChange,
  onAddChild,
}: Readonly<IModalPropertiesEditorProps>) {
  const [childType, setChildType] = useState<ModalChildComponentType>("TextInput");
  const titleId = `modal-title-${componentKey}`;
  const widthId = `modal-width-${componentKey}`;
  const positionId = `modal-position-${componentKey}`;
  const dismissibleId = `modal-dismissible-${componentKey}`;
  const childTypeId = `modal-child-type-${componentKey}`;

  function changeTitle(title: string) {
    onChange({ ...properties, title });
  }

  function changeWidth(width: "small" | "medium" | "large") {
    onChange({ ...properties, width });
  }

  function changePosition(position: "center" | "left" | "right") {
    onChange({ ...properties, position });
  }

  function changeDismissible(dismissible: boolean) {
    onChange({ ...properties, dismissible });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Modal properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Dialog title</Label>
        <Input
          id={titleId}
          name="title"
          maxLength={2000}
          value={readText(properties.title)}
          onChange={(event) => changeTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={widthId}>Dialog width</Label>
        <select
          id={widthId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={readWidth(properties.width)}
          onChange={(event) => changeWidth(event.target.value as "small" | "medium" | "large")}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={positionId}>Dialog position</Label>
        <select
          id={positionId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={readPosition(properties.position)}
          onChange={(event) => changePosition(event.target.value as "center" | "left" | "right")}
        >
          <option value="center">Center</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={dismissibleId}
          checked={readDismissible(properties.dismissible)}
          onCheckedChange={changeDismissible}
        />
        <Label htmlFor={dismissibleId}>Allow dialog dismissal</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        A workflow opens this dialog with its Show Modal action.
      </p>
      <div className="grid gap-2">
        <Label htmlFor={childTypeId}>Modal content type</Label>
        <select
          id={childTypeId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={childType}
          onChange={(event) => setChildType(event.target.value as ModalChildComponentType)}
        >
          {MODAL_CHILD_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => onAddChild(childType)}>
          Add modal content
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {childCount === 1 ? "1 direct child" : `${childCount} direct children`} in saved order
        </p>
      </div>
    </fieldset>
  );
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "My Modal";
}

function readWidth(value: unknown): "small" | "medium" | "large" {
  return value === "small" || value === "medium" || value === "large"
    ? value
    : "large";
}

function readPosition(value: unknown): "center" | "left" | "right" {
  return value === "left" || value === "right" ? value : "center";
}

function readDismissible(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

export default ModalPropertiesEditor;
