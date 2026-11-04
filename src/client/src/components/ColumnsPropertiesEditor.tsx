import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  LAYOUT_CHILD_TYPES,
  type LayoutChildComponentType,
} from "../utils/projectComponentFactory";

const MAX_COLUMN_COUNT = 12;

interface IColumnsPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childCount: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onAddChild: (type: LayoutChildComponentType) => void;
}

function ColumnsPropertiesEditor({
  componentKey,
  properties,
  childCount,
  disabled,
  onChange,
  onAddChild,
}: Readonly<IColumnsPropertiesEditorProps>) {
  const [childType, setChildType] = useState<LayoutChildComponentType>("TextInput");
  const columnCountId = `columns-count-${componentKey}`;
  const childTypeId = `columns-child-type-${componentKey}`;
  const columnCount = readColumnCount(properties.columnCount);

  function changeColumnCount(value: string) {
    const nextColumnCount = Number(value);
    if (Number.isSafeInteger(nextColumnCount)) {
      onChange({ ...properties, columnCount: nextColumnCount });
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Columns properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={columnCountId}>Column count</Label>
        <select
          id={columnCountId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={columnCount}
          onChange={(event) => changeColumnCount(event.target.value)}
        >
          {Array.from({ length: MAX_COLUMN_COUNT }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count} disabled={count < childCount}>
              {count} {count === 1 ? "column" : "columns"}
            </option>
          ))}
        </select>
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
        <Button
          type="button"
          variant="outline"
          disabled={childCount >= columnCount}
          onClick={() => onAddChild(childType)}
        >
          Add child component
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {childCount} of {columnCount} column slots filled
        </p>
      </div>
    </fieldset>
  );
}

function readColumnCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 2;
}

export default ColumnsPropertiesEditor;
