import { useId } from "react";
import { useWorkspaceLakebaseProvisionedInstances } from "../hooks/useWorkspaceLakebaseProvisionedInstances";
import { useWorkspaceLakebaseProvisionedSchemas } from "../hooks/useWorkspaceLakebaseProvisionedSchemas";
import { useWorkspaceLakebaseProvisionedTables } from "../hooks/useWorkspaceLakebaseProvisionedTables";
import type { IWorkspaceLakebaseTable, LakebaseProvisionedMetadataSelection } from "../models/WorkspaceLakebaseResources";
import type { LakebaseTableRef } from "../types/workflow/sharedReferences";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const DEFAULT_PROVISIONED_DATABASE = "databricks_postgres";

interface InstalledWorkspaceLakebaseProvisionedTableSelectorFieldsProps {
  value: LakebaseTableRef;
  onChange: (next: LakebaseTableRef, table?: IWorkspaceLakebaseTable | null) => void;
}

/** Selects a legacy Provisioned table in the workspace hosting this app. */
export default function InstalledWorkspaceLakebaseProvisionedTableSelectorFields({
  value,
  onChange,
}: Readonly<InstalledWorkspaceLakebaseProvisionedTableSelectorFieldsProps>) {
  const databaseInputId = useId();
  const instancesQuery = useWorkspaceLakebaseProvisionedInstances();
  const instanceName = resolvedValue(value.instanceName);
  const databaseName = resolvedValue(value.database) || DEFAULT_PROVISIONED_DATABASE;
  const metadataSelection: LakebaseProvisionedMetadataSelection | null = instanceName
    ? { instanceName, databaseName }
    : null;
  const schemasQuery = useWorkspaceLakebaseProvisionedSchemas(metadataSelection);
  const tablesQuery = useWorkspaceLakebaseProvisionedTables(metadataSelection, value.schema || null);
  const selectableTables = tablesQuery.data?.items.filter((table) => table.tableType === "BASE TABLE") ?? [];

  function updateInstance(nextInstanceName: string) {
    onChange({ ...value, instanceName: nextInstanceName, database: databaseName, catalog: databaseName, schema: "", table: "" });
  }

  function updateDatabase(nextDatabaseName: string) {
    onChange({ ...value, database: nextDatabaseName, catalog: nextDatabaseName, schema: "", table: "" });
  }

  function updateSchema(schema: string) {
    onChange({ ...value, database: databaseName, catalog: databaseName, schema, table: "" });
  }

  function updateTable(table: string) {
    const tableMetadata = tablesQuery.data?.items.find((item) => item.name === table) ?? null;
    onChange({ ...value, database: databaseName, catalog: databaseName, table }, tableMetadata);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InstalledWorkspaceResourceSelect
          label="Lakebase Provisioned instance"
          value={instanceName}
          placeholder="Select an instance in this workspace"
          options={instancesQuery.data?.items.map((instance) => ({
            value: instance.instanceName,
            label: `${instance.instanceName}${instance.state ? ` · ${instance.state}` : ""}`,
          })) ?? []}
          loading={instancesQuery.isPending}
          error={instancesQuery.error}
          onChange={updateInstance}
        />
        <div className="grid gap-2">
          <Label htmlFor={databaseInputId}>PostgreSQL database</Label>
          <Input
            id={databaseInputId}
            value={databaseName}
            maxLength={63}
            onChange={(event) => updateDatabase(event.target.value)}
            disabled={!instanceName}
            aria-describedby={`${databaseInputId}-help`}
          />
          <p id={`${databaseInputId}-help`} className="text-xs text-muted-foreground">
            Defaults to databricks_postgres. Enter the database name on the selected instance.
          </p>
        </div>
        <InstalledWorkspaceResourceSelect
          label="Schema"
          value={resolvedValue(value.schema)}
          placeholder={instanceName ? "Select a schema" : "Select an instance first"}
          options={schemasQuery.data?.items.map((schema) => ({ value: schema.name, label: schema.name })) ?? []}
          loading={schemasQuery.isPending}
          error={schemasQuery.error}
          disabled={!metadataSelection}
          onChange={updateSchema}
        />
        <InstalledWorkspaceResourceSelect
          label="Base table"
          value={resolvedValue(value.table)}
          placeholder={value.schema ? "Select a table" : "Select a schema first"}
          options={selectableTables.map((table) => ({ value: table.name, label: table.name }))}
          loading={tablesQuery.isPending}
          error={tablesQuery.error}
          disabled={!metadataSelection || !value.schema}
          emptyLabel="No base tables found"
          onChange={updateTable}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Metadata is read with your Databricks identity. It does not grant table write access; your Lakebase role must have the permissions required by the generated app.
      </p>
    </div>
  );
}

function resolvedValue(value: string): string {
  return value.startsWith("unresolved_resource_") ? "" : value;
}
