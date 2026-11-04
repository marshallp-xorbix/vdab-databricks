import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import {
  NETWORK_WEB_STORY_AXES,
  readNetworkWebStoryAxis,
  type NetworkWebStoryAxisConfiguration,
  type NetworkWebStoryAxisName,
} from "../types/networkWebStory";

interface INetworkWebStoryFieldMappingsEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  columns: IWorkspaceTableColumn[];
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

function NetworkWebStoryFieldMappingsEditor({
  componentKey,
  properties,
  columns,
  disabled,
  onPropertiesChange,
}: Readonly<INetworkWebStoryFieldMappingsEditorProps>) {
  function changeAxis(name: NetworkWebStoryAxisName, axis: NetworkWebStoryAxisConfiguration) {
    onPropertiesChange({ ...properties, [name]: axis });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Network web field mappings</legend>
      <p className="text-sm text-muted-foreground">
        Map source and target nodes plus relationship weight. The query is limited to 1,000 source rows before graph caps.
      </p>
      {NETWORK_WEB_STORY_AXES.map((definition) => {
        const axis = readNetworkWebStoryAxis(properties[definition.name], definition);
        const fieldId = `network-web-${definition.name}-${componentKey}`;
        const options = axis.field !== "" && !columns.some((column) => column.name === axis.field)
          ? [axis.field, ...columns.map((column) => column.name)]
          : columns.map((column) => column.name);
        return (
          <div key={definition.name} className="grid gap-2">
            <Label htmlFor={`${fieldId}-column`}>
              {definition.label} column{definition.required ? " (required)" : " (optional)"}
            </Label>
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
        );
      })}
      {columns.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Select a current-workspace Unity Catalog table with column metadata to map network fields.
        </p>
      )}
    </fieldset>
  );
}

export default NetworkWebStoryFieldMappingsEditor;
