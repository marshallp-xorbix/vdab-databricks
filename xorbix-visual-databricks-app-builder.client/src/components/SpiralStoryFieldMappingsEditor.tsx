import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import {
  readSpiralStoryAxis,
  SPIRAL_STORY_AXES,
  type SpiralStoryAxisConfiguration,
  type SpiralStoryAxisName,
} from "../types/spiralStory";

interface ISpiralStoryFieldMappingsEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  columns: IWorkspaceTableColumn[];
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const TRANSFORM_LABELS: Record<string, string> = {
  none: "Default aggregation", sum: "Sum", avg: "Average", min: "Minimum", max: "Maximum",
  count: "Count", count_distinct: "Count distinct",
};

function SpiralStoryFieldMappingsEditor({
  componentKey,
  properties,
  columns,
  disabled,
  onPropertiesChange,
}: Readonly<ISpiralStoryFieldMappingsEditorProps>) {
  function changeAxis(name: SpiralStoryAxisName, axis: SpiralStoryAxisConfiguration) {
    onPropertiesChange({ ...properties, [name]: axis });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Spiral story field mappings</legend>
      <p className="text-sm text-muted-foreground">
        Milestones group by journey and stage, ordered by timeline, up to 100 rows.
      </p>
      {SPIRAL_STORY_AXES.map((definition) => {
        const axis = readSpiralStoryAxis(properties[definition.name], definition);
        const fieldId = `spiral-${definition.name}-${componentKey}`;
        const options = axis.field !== "" && !columns.some((column) => column.name === axis.field)
          ? [axis.field, ...columns.map((column) => column.name)]
          : columns.map((column) => column.name);
        return (
          <fieldset key={definition.name} className="grid gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              {definition.label}{definition.required ? " (required)" : " (optional)"}
            </legend>
            <div className="grid gap-2">
              <Label htmlFor={`${fieldId}-column`}>{definition.label} column</Label>
              <select
                id={`${fieldId}-column`}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={axis.field}
                onChange={(event) => changeAxis(definition.name, { ...axis, field: event.target.value })}
              >
                <option value="">Choose a column</option>
                {options.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </div>
            {definition.transforms.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor={`${fieldId}-transform`}>{definition.label} aggregation</Label>
                <select
                  id={`${fieldId}-transform`}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={axis.transform}
                  onChange={(event) => changeAxis(definition.name, { ...axis, transform: event.target.value })}
                >
                  {definition.transforms.map((transform) => (
                    <option key={transform} value={transform}>{TRANSFORM_LABELS[transform] ?? transform}</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>
        );
      })}
      {columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Select a current-workspace Unity Catalog table with column metadata to map journey milestones.
        </p>
      )}
    </fieldset>
  );
}

export default SpiralStoryFieldMappingsEditor;
