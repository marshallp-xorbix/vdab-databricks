import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceLakebaseBranches } from "../hooks/useWorkspaceLakebaseBranches";
import { useWorkspaceLakebaseDatabases } from "../hooks/useWorkspaceLakebaseDatabases";
import { useWorkspaceLakebaseProjects } from "../hooks/useWorkspaceLakebaseProjects";
import { useWorkspaceLakebaseProvisionedInstances } from "../hooks/useWorkspaceLakebaseProvisionedInstances";
import {
  buildAutoscalingPostgresBranchPath,
  buildAutoscalingPostgresDatabasePath,
  parseAutoscalingPostgresDatabasePath,
} from "../utils/appResourcePostgresPath";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";
import { Input } from "./ui/input";

type OnChange = (resource: IWorkspaceAppResource) => void;

/** Cascading project/branch/database pickers for Autoscaling Lakebase grants. */
export function AutoscalingPostgresTargetFields({
  resource,
  onChange,
}: Readonly<{
  resource: Extract<IWorkspaceAppResource, { postgres: unknown }>;
  onChange: OnChange;
}>) {
  const parsed = parseAutoscalingPostgresDatabasePath(resource.postgres.database);
  const projectId = parsed?.projectId ?? "";
  const branchId = parsed?.branchId ?? "";
  const databaseId = parsed?.databaseId ?? "";
  const projects = useWorkspaceLakebaseProjects();
  const branches = useWorkspaceLakebaseBranches(projectId || null);
  const databases = useWorkspaceLakebaseDatabases(
    projectId || null,
    branchId || null,
  );

  function updateSelection(next: {
    projectId: string;
    branchId: string;
    databaseId: string;
  }) {
    const hasTarget =
      next.projectId.length > 0 &&
      next.branchId.length > 0 &&
      next.databaseId.length > 0;
    onChange({
      ...resource,
      postgres: {
        ...resource.postgres,
        ...(hasTarget
          ? {
              branch: buildAutoscalingPostgresBranchPath(
                next.projectId,
                next.branchId,
              ),
              database: buildAutoscalingPostgresDatabasePath(
                next.projectId,
                next.branchId,
                next.databaseId,
              ),
            }
          : {
              branch: undefined,
              database: "",
            }),
      },
    });
  }

  return (
    <div className="grid min-w-0 gap-2">
      <InstalledWorkspaceResourceSelect
        label={`Lakebase project for ${resource.name}`}
        value={projectId}
        emptyLabel="No Lakebase projects found"
        placeholder="Select a project…"
        options={(projects.data?.items ?? []).map((item) => ({
          value: item.projectId,
          label: item.displayName,
        }))}
        loading={projects.isLoading}
        error={projects.error}
        onChange={(nextProjectId) =>
          updateSelection({
            projectId: nextProjectId,
            branchId: "",
            databaseId: "",
          })
        }
      />
      <InstalledWorkspaceResourceSelect
        label={`Branch for ${resource.name}`}
        value={branchId}
        emptyLabel="No branches found"
        placeholder={projectId ? "Select a branch…" : "Select a project first"}
        options={(branches.data?.items ?? []).map((item) => ({
          value: item.branchId,
          label: `${item.branchId}${item.isDefault ? " (default)" : ""} · ${item.state}`,
        }))}
        loading={Boolean(projectId) && branches.isLoading}
        error={branches.error}
        disabled={!projectId}
        onChange={(nextBranchId) =>
          updateSelection({
            projectId,
            branchId: nextBranchId,
            databaseId: "",
          })
        }
      />
      <InstalledWorkspaceResourceSelect
        label={`Database for ${resource.name}`}
        value={databaseId}
        emptyLabel="No databases found"
        placeholder={branchId ? "Select a database…" : "Select a branch first"}
        options={(databases.data?.items ?? []).map((item) => ({
          value: item.databaseId,
          label: item.databaseName,
        }))}
        loading={Boolean(branchId) && databases.isLoading}
        error={databases.error}
        disabled={!branchId}
        onChange={(nextDatabaseId) =>
          updateSelection({
            projectId,
            branchId,
            databaseId: nextDatabaseId,
          })
        }
      />
    </div>
  );
}

/** Instance picker plus database name for Provisioned Lakebase grants. */
export function ProvisionedDatabaseTargetFields({
  resource,
  onChange,
}: Readonly<{
  resource: Extract<IWorkspaceAppResource, { database: unknown }>;
  onChange: OnChange;
}>) {
  const instances = useWorkspaceLakebaseProvisionedInstances();
  return (
    <div className="grid min-w-0 gap-2">
      <InstalledWorkspaceResourceSelect
        label={`Lakebase instance for ${resource.name}`}
        value={resource.database.instance_name}
        emptyLabel="No Lakebase instances found"
        placeholder="Select an instance…"
        options={(instances.data?.items ?? []).map((item) => ({
          value: item.instanceName,
          label: item.state
            ? `${item.instanceName} · ${item.state}`
            : item.instanceName,
        }))}
        loading={instances.isLoading}
        error={instances.error}
        onChange={(instanceName) =>
          onChange({
            ...resource,
            database: {
              ...resource.database,
              instance_name: instanceName,
              database_name:
                resource.database.database_name || "databricks_postgres",
            },
          })
        }
      />
      <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
        <span>{`Database for ${resource.name}`}</span>
        <Input
          value={resource.database.database_name}
          maxLength={128}
          placeholder="databricks_postgres"
          disabled={!resource.database.instance_name}
          onChange={(event) =>
            onChange({
              ...resource,
              database: {
                ...resource.database,
                database_name: event.target.value,
              },
            })
          }
        />
      </label>
    </div>
  );
}
