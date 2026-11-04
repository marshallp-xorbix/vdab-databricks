import { useEffect, useId, useState, type FC } from "react";
import type { IWorkspaceLakebaseTable } from "../../models/WorkspaceLakebaseResources";
import {
  useWorkspaceLakebaseProvisionedInstances,
} from "../../hooks/useWorkspaceLakebaseProvisionedInstances";
import { useWorkspaceLakebaseProvisionedSchemas } from "../../hooks/useWorkspaceLakebaseProvisionedSchemas";
import { useWorkspaceLakebaseProvisionedTables } from "../../hooks/useWorkspaceLakebaseProvisionedTables";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import InstalledWorkspaceResourceSelect from "../InstalledWorkspaceResourceSelect";

export interface LakebaseSelectorValue {
  instanceName?: string;
  schema?: string;
  table?: string;
  database?: string;
}

interface LakebaseTableSelectorFieldsProps {
  value: LakebaseSelectorValue;
  onChange: (next: LakebaseSelectorValue, table?: IWorkspaceLakebaseTable | null) => void;
  layoutVariant?: "default" | "propertyPanel";
}

const DEFAULT_DATABASE_NAME = "databricks_postgres";

/** Selects schemas and tables from a Lakebase Provisioned database in this workspace. */
export const LakebaseTableSelectorFields: FC<
  LakebaseTableSelectorFieldsProps
> = ({ value, onChange, layoutVariant = "default" }) => {
  const databaseInputId = useId();
  const [databaseName, setDatabaseName] = useState(
    value.database || DEFAULT_DATABASE_NAME,
  );
  const instancesQuery = useWorkspaceLakebaseProvisionedInstances();
  const selection = value.instanceName
    ? {
        instanceName: value.instanceName,
        databaseName: value.database || DEFAULT_DATABASE_NAME,
      }
    : null;
  const schemasQuery = useWorkspaceLakebaseProvisionedSchemas(selection);
  const tablesQuery = useWorkspaceLakebaseProvisionedTables(
    selection,
    value.schema || null,
  );
  const isPropertyPanel = layoutVariant === "propertyPanel";

  useEffect(() => {
    setDatabaseName(value.database || DEFAULT_DATABASE_NAME);
  }, [value.database]);

  function updateInstance(instanceName: string) {
    onChange({
      instanceName,
      database: databaseName.trim() || DEFAULT_DATABASE_NAME,
    });
  }

  function updateDatabase() {
    const nextDatabaseName = databaseName.trim() || DEFAULT_DATABASE_NAME;
    setDatabaseName(nextDatabaseName);
    if (nextDatabaseName === value.database) return;
    onChange({
      ...value,
      database: nextDatabaseName,
      schema: undefined,
      table: undefined,
    });
  }

  function updateSchema(schema: string) {
    onChange({ ...value, schema, table: undefined });
  }

  function updateTable(table: string) {
    const tableMetadata =
      tablesQuery.data?.items.find((item) => item.name === table) ?? null;
    onChange({ ...value, table }, tableMetadata);
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${isPropertyPanel ? "" : "md:grid-cols-2"}`}>
        <InstalledWorkspaceResourceSelect
          label="Database instance"
          value={value.instanceName || ""}
          placeholder="Select an instance"
          options={instancesQuery.data?.items.map((instance) => ({
            value: instance.instanceName,
            label: `${instance.instanceName}${instance.state ? ` · ${instance.state}` : ""}`,
          })) ?? []}
          loading={instancesQuery.isPending}
          error={instancesQuery.error}
          onChange={updateInstance}
        />
        <div className="min-w-0 space-y-1">
          <Label className="text-sm" htmlFor={databaseInputId}>
            Database
          </Label>
          <Input
            id={databaseInputId}
            value={databaseName}
            onChange={(event) => setDatabaseName(event.target.value)}
            onBlur={updateDatabase}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder={DEFAULT_DATABASE_NAME}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <div className={`grid gap-3 ${isPropertyPanel ? "" : "md:grid-cols-2"}`}>
        <InstalledWorkspaceResourceSelect
          label="Schema"
          value={value.schema || ""}
          placeholder={selection ? "Select a schema" : "Select an instance first"}
          options={schemasQuery.data?.items.map((schema) => ({
            value: schema.name,
            label: schema.name,
          })) ?? []}
          loading={Boolean(selection && schemasQuery.isPending)}
          error={selection ? schemasQuery.error : null}
          disabled={!selection}
          onChange={updateSchema}
        />
        <InstalledWorkspaceResourceSelect
          label="Table"
          value={value.table || ""}
          placeholder={value.schema ? "Select a table" : "Select a schema first"}
          options={tablesQuery.data?.items.map((table) => ({
            value: table.name,
            label: table.name,
          })) ?? []}
          loading={Boolean(selection && value.schema && tablesQuery.isPending)}
          error={selection && value.schema ? tablesQuery.error : null}
          disabled={!selection || !value.schema}
          onChange={updateTable}
        />
      </div>
    </div>
  );
};
