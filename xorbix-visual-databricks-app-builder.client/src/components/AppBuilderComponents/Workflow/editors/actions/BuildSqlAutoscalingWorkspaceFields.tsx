import type { FC } from "react";
import InstalledWorkspaceResourceSelect from "../../../../InstalledWorkspaceResourceSelect";
import { useWorkspaceLakebaseBranches } from "../../../../../hooks/useWorkspaceLakebaseBranches";
import { useWorkspaceLakebaseEndpoints } from "../../../../../hooks/useWorkspaceLakebaseEndpoints";
import { useWorkspaceLakebaseDatabases } from "../../../../../hooks/useWorkspaceLakebaseDatabases";
import { useWorkspaceLakebaseProjects } from "../../../../../hooks/useWorkspaceLakebaseProjects";
import {
  isWorkflowActionNode,
  type WorkflowActionNodeByType,
} from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import { isUnresolvedResource } from "./buildSqlSourceOptions";

interface IBuildSqlAutoscalingWorkspaceFieldsProps {
  workflowId: string;
  node: WorkflowActionNodeByType<"BuildSql">;
  onUpdateNode: WorkflowActionEditorProps["onUpdateNode"];
}

/** Selects the current-workspace Autoscaling project, branch, endpoint, and database. */
const BuildSqlAutoscalingWorkspaceFields: FC<
  Readonly<IBuildSqlAutoscalingWorkspaceFieldsProps>
> = ({ workflowId, node, onUpdateNode }) => {
  const projectId = isUnresolvedResource(node.params.lakebaseProjectId)
    ? null
    : (node.params.lakebaseProjectId ?? null);
  const branchId = isUnresolvedResource(node.params.lakebaseBranchId)
    ? null
    : (node.params.lakebaseBranchId ?? null);
  const projectsQuery = useWorkspaceLakebaseProjects();
  const branchesQuery = useWorkspaceLakebaseBranches(projectId);
  const endpointsQuery = useWorkspaceLakebaseEndpoints(projectId, branchId);
  const databasesQuery = useWorkspaceLakebaseDatabases(projectId, branchId);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <InstalledWorkspaceResourceSelect
        label="Lakebase project"
        value={
          isUnresolvedResource(node.params.lakebaseProjectId)
            ? ""
            : (node.params.lakebaseProjectId ?? "")
        }
        placeholder="Select a current-workspace project"
        options={
          projectsQuery.data?.items.map((project) => ({
            value: project.projectId,
            label: project.displayName,
          })) ?? []
        }
        loading={projectsQuery.isPending}
        error={projectsQuery.error}
        onChange={(nextProjectId) =>
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "BuildSql")
              ? {
                  ...current,
                  params: {
                    ...current.params,
                    lakebaseProjectId: nextProjectId,
                    lakebaseBranchId: undefined,
                    lakebaseEndpointId: undefined,
                    lakebaseDatabaseName: undefined,
                    lakebaseDatabaseId: undefined,
                    lakebaseAppResourceName: undefined,
                  },
                }
              : current,
          )
        }
      />
      <InstalledWorkspaceResourceSelect
        label="Lakebase branch"
        value={
          isUnresolvedResource(node.params.lakebaseBranchId)
            ? ""
            : (node.params.lakebaseBranchId ?? "")
        }
        placeholder={
          node.params.lakebaseProjectId
            ? "Select a branch"
            : "Select a project first"
        }
        options={
          branchesQuery.data?.items.map((branch) => ({
            value: branch.branchId,
            label: `${branch.branchId}${branch.isDefault ? " (default)" : ""} · ${branch.state}`,
          })) ?? []
        }
        loading={branchesQuery.isPending}
        error={branchesQuery.error}
        disabled={!node.params.lakebaseProjectId}
        onChange={(nextBranchId) =>
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "BuildSql")
              ? {
                  ...current,
                  params: {
                    ...current.params,
                    lakebaseBranchId: nextBranchId,
                    lakebaseEndpointId: undefined,
                    lakebaseDatabaseName: undefined,
                    lakebaseDatabaseId: undefined,
                    lakebaseAppResourceName: undefined,
                  },
                }
              : current,
          )
        }
      />
      <InstalledWorkspaceResourceSelect
        label="Lakebase read-write endpoint"
        value={
          isUnresolvedResource(node.params.lakebaseEndpointId)
            ? ""
            : (node.params.lakebaseEndpointId ?? "")
        }
        placeholder={
          node.params.lakebaseBranchId
            ? "Select an endpoint"
            : "Select a branch first"
        }
        options={
          endpointsQuery.data?.items
            .filter((endpoint) => endpoint.endpointType === "read-write")
            .map((endpoint) => ({
              value: endpoint.endpointId,
              label: `${endpoint.endpointId} · ${endpoint.state}`,
            })) ?? []
        }
        loading={endpointsQuery.isPending}
        error={endpointsQuery.error}
        disabled={!node.params.lakebaseBranchId}
        emptyLabel="No read-write endpoints found"
        onChange={(endpointId) =>
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "BuildSql")
              ? {
                  ...current,
                  params: {
                    ...current.params,
                    lakebaseEndpointId: endpointId,
                    lakebaseDatabaseName: undefined,
                    lakebaseDatabaseId: undefined,
                    lakebaseAppResourceName: undefined,
                  },
                }
              : current,
          )
        }
      />
      <InstalledWorkspaceResourceSelect
        label="Lakebase database"
        value={
          isUnresolvedResource(node.params.lakebaseDatabaseName)
            ? ""
            : (node.params.lakebaseDatabaseName ?? "")
        }
        placeholder={branchId ? "Select a database" : "Select a branch first"}
        options={
          databasesQuery.data?.items.map((database) => ({
            value: database.databaseName,
            label: database.databaseName,
          })) ?? []
        }
        loading={databasesQuery.isPending}
        error={databasesQuery.error}
        disabled={!node.params.lakebaseBranchId}
        onChange={(databaseName) => {
          const databaseId = databasesQuery.data?.items.find(
            (database) => database.databaseName === databaseName,
          )?.databaseId;
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "BuildSql")
              ? {
                  ...current,
                  params: {
                    ...current.params,
                    lakebaseAppResourceName: "postgres",
                    lakebaseDatabaseName: databaseName,
                    lakebaseDatabaseId: databaseId,
                  },
                }
              : current,
          );
        }}
      />
      <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
        The selected database is bound as the generated child App’s `postgres`
        resource. Each viewer still needs the postgres scope and a Lakebase role
        with the required grants.
      </p>
      {[
        node.params.lakebaseAppResourceName,
        node.params.lakebaseDatabaseName,
        node.params.lakebaseDatabaseId,
        node.params.lakebaseProjectId,
        node.params.lakebaseBranchId,
        node.params.lakebaseEndpointId,
      ].some(isUnresolvedResource) ? (
        <p className="text-xs text-warning-foreground md:col-span-2 xl:col-span-3">
          This project was imported from another workspace. Select the Lakebase
          resource, project, branch, and endpoint in this workspace before
          previewing or deploying.
        </p>
      ) : null}
    </div>
  );
};

export default BuildSqlAutoscalingWorkspaceFields;
