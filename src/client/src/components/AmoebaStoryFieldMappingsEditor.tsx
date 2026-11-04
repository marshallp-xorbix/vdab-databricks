import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import {
  AMOEBA_STORY_AXES,
  readAmoebaStoryAxis,
  type AmoebaStoryAxisName,
  type IAmoebaStoryAxisConfiguration,
} from "../types/amoebaStory";

interface IAmoebaStoryFieldMappingsEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  columns: IWorkspaceTableColumn[];
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const TRANSFORM_LABELS: Record<string, string> = {
  none: "No aggregation",
  sum: "Sum",
  avg: "Average",
  count: "Count",
  count_distinct: "Count distinct",
  min: "Minimum",
  max: "Maximum",
};

function AmoebaStoryFieldMappingsEditor({
  componentKey,
  properties,
  columns,
  disabled,
  onPropertiesChange,
}: Readonly<IAmoebaStoryFieldMappingsEditorProps>) {
  function changeAxis(name: AmoebaStoryAxisName, axis: IAmoebaStoryAxisConfiguration) {
    onPropertiesChange({ ...properties, [name]: axis });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Amoeba story field mappings</legend>
      <p className="text-sm text-muted-foreground">
        Map the entity fields and measures. Seven mappings are required for the story preview.
      </p>
      {AMOEBA_STORY_AXES.map((definition) => {
        const axis = readAmoebaStoryAxis(properties[definition.name], definition);
        const fieldId = `amoeba-${definition.name}-column-${componentKey}`;
        const labelId = `amoeba-${definition.name}-label-${componentKey}`;
        const transformId = `amoeba-${definition.name}-transform-${componentKey}`;
        const options = axis.field !== "" && !columns.some((column) => column.name === axis.field)
          ? [axis.field, ...columns.map((column) => column.name)]
          : columns.map((column) => column.name);
        return (
          <fieldset key={definition.name} className="grid gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              {definition.label}{definition.required ? " (required)" : " (optional)"}
            </legend>
            <div className="grid gap-2">
              <Label htmlFor={fieldId}>{definition.label} column</Label>
              <select
                id={fieldId}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={axis.field}
                onChange={(event) => changeAxis(definition.name, { ...axis, field: event.target.value })}
              >
                <option value="">Choose a column</option>
                {options.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={labelId}>{definition.label} display label</Label>
              <Input
                id={labelId}
                maxLength={500}
                value={axis.displayName}
                onChange={(event) => changeAxis(definition.name, { ...axis, displayName: event.target.value })}
              />
            </div>
            {definition.transforms.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor={transformId}>{definition.label} aggregation</Label>
                <select
                  id={transformId}
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
          Select a current-workspace Unity Catalog table with column metadata to map fields.
        </p>
      )}
    </fieldset>
  );
}

export default AmoebaStoryFieldMappingsEditor;
