import { useWorkspaceLakebaseBranches } from "../hooks/useWorkspaceLakebaseBranches";
import { useWorkspaceLakebaseDatabases } from "../hooks/useWorkspaceLakebaseDatabases";
import { useWorkspaceLakebaseEndpoints } from "../hooks/useWorkspaceLakebaseEndpoints";
import { useWorkspaceLakebaseProjects } from "../hooks/useWorkspaceLakebaseProjects";
import { useWorkspaceLakebaseSchemas } from "../hooks/useWorkspaceLakebaseSchemas";
import { useWorkspaceLakebaseTables } from "../hooks/useWorkspaceLakebaseTables";
import type { LakebaseMetadataSelection } from "../models/WorkspaceLakebaseResources";
import type { LakebaseAutoscalingTableRef } from "../types/workflow/sharedReferences";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";

interface InstalledWorkspaceLakebaseTableSelectorFieldsProps {
  value: LakebaseAutoscalingTableRef;
  onChange: (next: LakebaseAutoscalingTableRef) => void;
}

/** Selects a Lakebase table using short-lived credentials for the signed-in user. */
export default function InstalledWorkspaceLakebaseTableSelectorFields({
  value,
  onChange,
}: Readonly<InstalledWorkspaceLakebaseTableSelectorFieldsProps>) {
  const projectId = resolvedLakebaseSelection(value.projectId);
  const branchId = resolvedLakebaseSelection(value.branchId);
  const endpointId = resolvedLakebaseSelection(value.endpointId);
  const databaseName = resolvedLakebaseSelection(value.database);
  const projectsQuery = useWorkspaceLakebaseProjects();
  const branchesQuery = useWorkspaceLakebaseBranches(projectId || null);
  const endpointsQuery = useWorkspaceLakebaseEndpoints(
    projectId || null,
    branchId || null,
  );
  const databasesQuery = useWorkspaceLakebaseDatabases(
    projectId || null,
    branchId || null,
  );
  const metadataSelection: LakebaseMetadataSelection | null =
    projectId && branchId && endpointId && databaseName
      ? {
          projectId,
          branchId,
          endpointId,
          databaseName,
        }
      : null;
  const schemasQuery = useWorkspaceLakebaseSchemas(metadataSelection);
  const tablesQuery = useWorkspaceLakebaseTables(metadataSelection, value.schema || null);
  const selectableEndpoints = endpointsQuery.data?.items.filter(
    (endpoint) => endpoint.endpointType === "read-write",
  ) ?? [];
  const selectableTables = tablesQuery.data?.items.filter(
    (table) => table.tableType === "BASE TABLE",
  ) ?? [];

  function updateProject(projectId: string) {
    onChange({
      ...value,
      projectId,
      branchId: "",
      endpointId: "",
      database: "",
      catalog: "",
      schema: "",
      table: "",
    });
  }

  function updateBranch(branchId: string) {
    onChange({
      ...value,
      branchId,
      endpointId: "",
      database: "",
      catalog: "",
      schema: "",
      table: "",
    });
  }

  function updateEndpoint(endpointId: string) {
    onChange({
      ...value,
      endpointId,
      database: "",
      catalog: "",
      schema: "",
      table: "",
    });
  }

  function updateDatabase(databaseName: string) {
    onChange({
      ...value,
      database: databaseName,
      catalog: databaseName,
      schema: "",
      table: "",
    });
  }

  function updateSchema(schema: string) {
    onChange({ ...value, schema, table: "" });
  }

  function updateTable(table: string) {
    onChange({ ...value, table });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <InstalledWorkspaceResourceSelect
        label="Lakebase project"
        value={projectId}
        placeholder="Select a project"
        options={projectsQuery.data?.items.map((project) => ({
          value: project.projectId,
          label: project.displayName,
        })) ?? []}
        loading={projectsQuery.isPending}
        error={projectsQuery.error}
        onChange={updateProject}
      />
      <InstalledWorkspaceResourceSelect
        label="Branch"
        value={branchId}
        placeholder={projectId ? "Select a branch" : "Select a project first"}
        options={branchesQuery.data?.items.map((branch) => ({
          value: branch.branchId,
          label: `${branch.branchId}${branch.isDefault ? " (default)" : ""} · ${branch.state}`,
        })) ?? []}
        loading={branchesQuery.isPending}
        error={branchesQuery.error}
        disabled={!projectId}
        onChange={updateBranch}
      />
      <InstalledWorkspaceResourceSelect
        label="Read-write endpoint"
        value={endpointId}
        placeholder={branchId ? "Select a read-write endpoint" : "Select a branch first"}
        options={selectableEndpoints.map((endpoint) => ({
          value: endpoint.endpointId,
          label: `${endpoint.endpointId} · ${endpoint.state}`,
        }))}
        loading={endpointsQuery.isPending}
        error={endpointsQuery.error}
        disabled={!branchId}
        emptyLabel="No read-write endpoints found"
        onChange={updateEndpoint}
      />
      <InstalledWorkspaceResourceSelect
        label="Database"
        value={databaseName}
        placeholder={branchId ? "Select a database" : "Select a branch first"}
        options={databasesQuery.data?.items.map((database) => ({
          value: database.databaseName,
          label: database.databaseName,
        })) ?? []}
        loading={databasesQuery.isPending}
        error={databasesQuery.error}
        disabled={!branchId}
        onChange={updateDatabase}
      />
      <InstalledWorkspaceResourceSelect
        label="Schema"
        value={resolvedLakebaseSelection(value.schema)}
        placeholder={databaseName ? "Select a schema" : "Select a database first"}
        options={schemasQuery.data?.items.map((schema) => ({ value: schema.name, label: schema.name })) ?? []}
        loading={schemasQuery.isPending}
        error={schemasQuery.error}
        disabled={!metadataSelection}
        onChange={updateSchema}
      />
      <InstalledWorkspaceResourceSelect
        label="Table"
        value={resolvedLakebaseSelection(value.table)}
        placeholder={resolvedLakebaseSelection(value.schema) ? "Select a table" : "Select a schema first"}
        options={selectableTables.map((table) => ({ value: table.name, label: table.name }))}
        loading={tablesQuery.isPending}
        error={tablesQuery.error}
        disabled={!metadataSelection || !resolvedLakebaseSelection(value.schema)}
        emptyLabel="No base tables found"
        onChange={updateTable}
      />
      </div>
      <p className="text-xs text-muted-foreground">
        Metadata visibility does not grant write access. Ensure your Lakebase PostgreSQL role has permission to insert into the selected table.
      </p>
      {[
        value.projectId,
        value.branchId,
        value.endpointId,
        value.database,
        value.schema,
        value.table,
      ].some((selection) => selection.startsWith("unresolved_resource_")) ? (
        <p className="text-xs text-warning-foreground">
          This project was imported from another workspace. Reselect each Lakebase value above before previewing or deploying.
        </p>
      ) : null}
    </div>
  );
}

function resolvedLakebaseSelection(value: string): string {
  return value.startsWith("unresolved_resource_") ? "" : value;
}
