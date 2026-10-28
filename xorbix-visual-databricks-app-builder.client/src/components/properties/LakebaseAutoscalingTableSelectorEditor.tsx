import type { FC } from "react";
import { getWorkspaceLakebaseTableColumns } from "../../api/lakebaseAutoscalingWorkspaceApi";
import {
  databricksDataConnectorApi,
  type UnityCatalogTableDetails,
} from "../../providers/DatabricksDataConnectorApi";
import type { Binding } from "../../types/components/bindings";
import {
  LakebaseAutoscalingTableSelectorFields,
  type LakebaseAutoscalingTableSelectorValue,
} from "./LakebaseAutoscalingTableSelectorFields";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { UnityCatalogColumn } from "../../types/components/bindings";

interface LakebaseAutoscalingBindingConfig {
  projectId?: string;
  branchId?: string;
  endpointId?: string;
  database?: string;
  catalog?: string;
  schema?: string;
  table?: string;
  columns?: unknown[];
  primaryKeyColumn?: string;
}

interface LakebaseAutoscalingTableSelectorEditorProps {
  binding: Binding;
  onChange: (binding: Binding) => void;
  workspaceConnectionId?: number;
}

/**
 * Lakebase Autoscaling table binding editor (project / branch / endpoint + UC table).
 */
export const LakebaseAutoscalingTableSelectorEditor: FC<
  LakebaseAutoscalingTableSelectorEditorProps
> = ({ binding, onChange, workspaceConnectionId }) => {
  const config = (binding.source.resource ||
    {}) as LakebaseAutoscalingBindingConfig;

  const value: LakebaseAutoscalingTableSelectorValue = {
    projectId: config.projectId,
    branchId: config.branchId,
    endpointId: config.endpointId,
    database: config.database,
    catalog: config.catalog as string | undefined,
    schema: config.schema as string | undefined,
    table: config.table as string | undefined,
  };
  const selectedPrimaryKeyColumn = config.primaryKeyColumn as
    | string
    | undefined;
  const columns = (config.columns as UnityCatalogColumn[] | undefined) ?? [];
  const columnNames = columns
    .map((column) => column.name)
    .filter((name): name is string => Boolean(name && name.length > 0));

  const updateConfig = (updates: Partial<LakebaseAutoscalingBindingConfig>) => {
    onChange({
      ...binding,
      source: {
        ...binding.source,
        kind: "resource",
        valueType: "table",
        resource: {
          ...config,
          type: "lakebaseAutoscaling",
          ...updates,
        },
      },
    });
  };

  const handleSelectionChange = async (
    next: LakebaseAutoscalingTableSelectorValue,
  ) => {
    const baseUpdates: Partial<LakebaseAutoscalingBindingConfig> = {
      projectId: next.projectId,
      branchId: next.branchId,
      endpointId: next.endpointId,
      catalog: next.catalog,
      schema: next.schema,
      table: next.table,
      database: next.database,
    };

    const unchanged =
      config.projectId === baseUpdates.projectId &&
      config.branchId === baseUpdates.branchId &&
      config.endpointId === baseUpdates.endpointId &&
      config.catalog === baseUpdates.catalog &&
      config.schema === baseUpdates.schema &&
      config.table === baseUpdates.table &&
      config.database === baseUpdates.database;
    if (unchanged) {
      return;
    }

    if (!next.table) {
      updateConfig({
        ...baseUpdates,
        columns: undefined,
        primaryKeyColumn: undefined,
      });
      return;
    }

    if (
      (import.meta.env.VITE_VDAB_RUNTIME !== "databricks" && (!workspaceConnectionId || workspaceConnectionId <= 0)) ||
      !next.projectId ||
      !next.branchId ||
      !next.database ||
      !next.schema
    ) {
      updateConfig(baseUpdates);
      return;
    }

    let tableDetails: UnityCatalogTableDetails | null = null;
    try {
      tableDetails = import.meta.env.VITE_VDAB_RUNTIME === "databricks"
        ? {
            columns: (await getWorkspaceLakebaseTableColumns(
              next.projectId,
              next.branchId,
              next.database,
              next.schema,
              next.table,
            )).map((column) => ({
              name: column.name,
              type: column.type,
              nullable: column.nullable,
            })),
          }
        : await databricksDataConnectorApi.getLakebaseAutoscalingTableDetails(
          workspaceConnectionId,
          next.projectId,
          next.branchId,
          next.endpointId ?? "",
          next.database,
          next.schema,
          next.table,
        );
    } catch (err) {
      console.error(
        "[LakebaseAutoscalingTableSelectorEditor] Error fetching table details:",
        err,
      );
    }

    updateConfig({
      ...baseUpdates,
      columns: tableDetails?.columns || [],
      primaryKeyColumn: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <LakebaseAutoscalingTableSelectorFields
        value={value}
        workspaceConnectionId={workspaceConnectionId}
        onChange={(next) => {
          void handleSelectionChange(next);
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
