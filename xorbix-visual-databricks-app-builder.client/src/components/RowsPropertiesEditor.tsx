import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  LAYOUT_CHILD_TYPES,
  type LayoutChildComponentType,
} from "../utils/projectComponentFactory";

const MAX_ROW_COUNT = 12;

interface IRowsPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childCount: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onAddChild: (type: LayoutChildComponentType) => void;
}

function RowsPropertiesEditor({
  componentKey,
  properties,
  childCount,
  disabled,
  onChange,
  onAddChild,
}: Readonly<IRowsPropertiesEditorProps>) {
  const [childType, setChildType] = useState<LayoutChildComponentType>("TextInput");
  const rowCountId = `rows-count-${componentKey}`;
  const childTypeId = `rows-child-type-${componentKey}`;
  const rowCount = readRowCount(properties.rowCount);

  function changeRowCount(value: string) {
    const nextRowCount = Number(value);
    if (Number.isSafeInteger(nextRowCount)) {
      onChange({ ...properties, rowCount: nextRowCount });
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Rows properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={rowCountId}>Row count</Label>
        <select
          id={rowCountId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={rowCount}
          onChange={(event) => changeRowCount(event.target.value)}
        >
          {Array.from({ length: MAX_ROW_COUNT }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count} disabled={count < childCount}>
              {count} {count === 1 ? "row" : "rows"}
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
          disabled={childCount >= rowCount}
          onClick={() => onAddChild(childType)}
        >
          Add child component
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {childCount} of {rowCount} row slots filled
        </p>
      </div>
    </fieldset>
  );
}

function readRowCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 2;
}

export default RowsPropertiesEditor;
