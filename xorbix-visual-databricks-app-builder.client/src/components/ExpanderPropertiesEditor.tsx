import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  LAYOUT_CHILD_TYPES,
  type LayoutChildComponentType,
} from "../utils/projectComponentFactory";

interface IExpanderPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childCount: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onAddChild: (type: LayoutChildComponentType) => void;
}

function ExpanderPropertiesEditor({
  componentKey,
  properties,
  childCount,
  disabled,
  onChange,
  onAddChild,
}: Readonly<IExpanderPropertiesEditorProps>) {
  const [childType, setChildType] = useState<LayoutChildComponentType>("TextInput");
  const titleId = `expander-title-${componentKey}`;
  const expandedId = `expander-expanded-${componentKey}`;
  const childTypeId = `expander-child-type-${componentKey}`;

  function changeTitle(sectionTitle: string) {
    onChange({ ...properties, sectionTitle });
  }

  function changeExpanded(defaultExpanded: boolean) {
    onChange({ ...properties, defaultExpanded });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Expander properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Section title</Label>
        <Input
          id={titleId}
          name="sectionTitle"
          maxLength={500}
          value={readText(properties.sectionTitle)}
          onChange={(event) => changeTitle(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={expandedId}
          checked={properties.defaultExpanded === true}
          onCheckedChange={changeExpanded}
        />
        <Label htmlFor={expandedId}>Expanded by default</Label>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={childTypeId}>Child component type</Label>
        <select
          id={childTypeId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={childType}
          onChange={(event) => setChildType(event.target.value as LayoutChildComponentType)}
        >
          {LAYOUT_CHILD_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => onAddChild(childType)}>
          Add child component
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {childCount === 1 ? "1 child component" : `${childCount} child components`}
        </p>
      </div>
    </fieldset>
  );
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "Section";
}

export default ExpanderPropertiesEditor;
