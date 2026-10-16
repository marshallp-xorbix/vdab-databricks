import type { FC } from "react";
import type { Binding } from "../../types/components/bindings";
import {
  LakebaseTableSelectorFields,
  type LakebaseSelectorValue,
} from "./LakebaseTableSelectorFields";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { UnityCatalogColumn } from "../../types/components/bindings";

interface LakebaseProvisionedDatabaseConfig {
  instanceName?: string;
  catalog?: string;
  schema?: string;
  table?: string;
  database?: string;
  columns?: unknown[];
  primaryKeyColumn?: string;
}

interface LakebaseProvisionedDatabaseSelectorEditorProps {
  binding: Binding;
  onChange: (binding: Binding) => void;
  workspaceConnectionId?: number;
}

/**
 * Lakebase Provisioned Database Selector Editor
 * Edits a LakebaseProvisionedDatabase binding config
 */
export const LakebaseProvisionedDatabaseSelectorEditor: FC<
  LakebaseProvisionedDatabaseSelectorEditorProps
> = ({ binding, onChange, workspaceConnectionId }) => {
  const config = (binding.source.resource ||
    {}) as LakebaseProvisionedDatabaseConfig;

  const value: LakebaseSelectorValue = {
    instanceName: config.instanceName as string | undefined,
    catalog: config.catalog as string | undefined,
    schema: config.schema as string | undefined,
    table: config.table as string | undefined,
    database: config.database as string | undefined,
  };
  const selectedPrimaryKeyColumn = config.primaryKeyColumn as
    | string
    | undefined;
  const columns = (config.columns as UnityCatalogColumn[] | undefined) ?? [];
  const columnNames = columns
    .map((column) => column.name)
    .filter((name): name is string => Boolean(name && name.length > 0));

  const updateConfig = (
    updates: Partial<LakebaseProvisionedDatabaseConfig>,
  ) => {
    onChange({
      ...binding,
      source: {
        ...binding.source,
        kind: "resource",
        valueType: "table",
        resource: {
          ...config,
          type: "lakebaseProvisionedDatabase",
          ...updates,
        },
      },
    });
  };

  const handleSelectionChange = (next: LakebaseSelectorValue) => {
    const baseUpdates: Partial<LakebaseProvisionedDatabaseConfig> = {
      instanceName: next.instanceName,
      catalog: next.catalog,
      schema: next.schema,
      table: next.table,
      database: next.database,
    };

    updateConfig({
      ...baseUpdates,
      // Lakebase bindings no longer fetch UC metadata here.
      columns: undefined,
      primaryKeyColumn: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <LakebaseTableSelectorFields
        value={value}
        workspaceConnectionId={workspaceConnectionId}
        layoutVariant="propertyPanel"
        onChange={(next) => {
          handleSelectionChange(next);
        }}
      />
      {columnNames.length > 0 && (
        <div className="space-y-2">
          <Label>Primary Key Column</Label>
          <Select
            value={selectedPrimaryKeyColumn ?? "__none"}
            onValueChange={(nextValue) => {
              updateConfig({
                primaryKeyColumn:
                  nextValue === "__none" ? undefined : nextValue,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select primary key column" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {columnNames.map((columnName) => (
                <SelectItem key={columnName} value={columnName}>
                  {columnName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
