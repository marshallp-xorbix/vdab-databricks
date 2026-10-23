import type { FC } from "react";
import InstalledWorkspaceResourceSelect from "../../../../InstalledWorkspaceResourceSelect";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { useWorkspaceSqlWarehouses } from "../../../../../hooks/useWorkspaceSqlWarehouses";
import { useWorkspaceLakebaseProvisionedInstances } from "../../../../../hooks/useWorkspaceLakebaseProvisionedInstances";
import type { NormalizedAppResource } from "../../../../../models/DatabricksAppModels";
import { AppResourceKindSlug } from "../../../../../types/appResourceKinds";
import {
  isWorkflowActionNode,
  type WorkflowActionNodeByType,
} from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import { isUnresolvedResource } from "./buildSqlSourceOptions";
import BuildSqlAutoscalingWorkspaceFields from "./BuildSqlAutoscalingWorkspaceFields";

const DEFAULT_PROVISIONED_DATABASE = "databricks_postgres";

interface IBuildSqlInstalledResourceFieldsProps {
  workflowId: string;
  node: WorkflowActionNodeByType<"BuildSql">;
  normalizedAppResources: NormalizedAppResource[];
  isStandaloneWorkspace: boolean;
  onUpdateNode: WorkflowActionEditorProps["onUpdateNode"];
}

/** Renders current-workspace SQL warehouse and app-bound Lakebase selectors. */
const BuildSqlInstalledResourceFields: FC<
  Readonly<IBuildSqlInstalledResourceFieldsProps>
> = ({
  workflowId,
  node,
  normalizedAppResources,
  isStandaloneWorkspace,
  onUpdateNode,
}) => {
  const sqlWarehousesQuery = useWorkspaceSqlWarehouses(isStandaloneWorkspace);
  const provisionedInstancesQuery = useWorkspaceLakebaseProvisionedInstances();
  const provisionedLakebaseResources = normalizedAppResources.filter(
    (resource) => resource.kind === AppResourceKindSlug.Database,
  );
  const autoscalingLakebaseResources = normalizedAppResources.filter(
    (resource) => resource.kind === AppResourceKindSlug.AutoscalingDatabase,
  );
  const lakebaseResourceOptions =
    node.params.sqlSourceKind === "lakebaseProvisionedDatabase"
      ? provisionedLakebaseResources
      : node.params.sqlSourceKind === "lakebaseAutoscaling"
        ? autoscalingLakebaseResources
        : [];

  if (!isWorkflowActionNode(node, "BuildSql")) {
    return null;
  }

  return (
    <>
      {isStandaloneWorkspace &&
        node.params.sqlSourceKind === "unityCatalogTable" && (
          <div className="space-y-1 rounded-md border border-border bg-muted/80 p-3">
            <InstalledWorkspaceResourceSelect
              label="SQL warehouse"
              value={node.params.sqlWarehouseId ?? ""}
              placeholder="Select a warehouse in this workspace"
              options={
                sqlWarehousesQuery.data?.items.map((warehouse) => ({
                  value: warehouse.id,
                  label: `${warehouse.name} · ${warehouse.state}`,
                })) ?? []
              }
              loading={sqlWarehousesQuery.isPending}
              error={
                sqlWarehousesQuery.error instanceof Error
                  ? sqlWarehousesQuery.error
                  : sqlWarehousesQuery.isError
                    ? new Error("SQL warehouses could not be loaded.")
                    : null
              }
              onChange={(warehouseId) => {
                const warehouse = sqlWarehousesQuery.data?.items.find(
                  (item) => item.id === warehouseId,
                );
                onUpdateNode(workflowId, node.id, (current) =>
                  isWorkflowActionNode(current, "BuildSql")
                    ? {
                        ...current,
                        params: {
                          ...current.params,
                          sqlWarehouseId: warehouse?.id,
                          sqlWarehouseName: warehouse?.name,
                        },
                      }
                    : current,
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              The generated RunSql action sends requests to the selected
              warehouse with the current viewer’s forwarded Databricks token.
              Each viewer still needs SQL authorization and warehouse access.
            </p>
          </div>
        )}

      {(node.params.sqlSourceKind === "lakebaseProvisionedDatabase" ||
        node.params.sqlSourceKind === "lakebaseAutoscaling") && (
        <div className="space-y-1 rounded-md border border-border bg-muted/80 p-3">
          {isStandaloneWorkspace &&
            node.params.sqlSourceKind === "lakebaseProvisionedDatabase" && (
              <InstalledWorkspaceResourceSelect
                label="Current-workspace Provisioned instance"
                value={
                  isUnresolvedResource(node.params.lakebaseInstanceName)
                    ? ""
                    : (node.params.lakebaseInstanceName ?? "")
                }
                placeholder="Select an instance in this workspace"
                options={
                  provisionedInstancesQuery.data?.items.map((instance) => ({
                    value: instance.instanceName,
                    label: `${instance.instanceName}${instance.state ? ` · ${instance.state}` : ""}`,
                  })) ?? []
                }
                loading={provisionedInstancesQuery.isPending}
                error={provisionedInstancesQuery.error}
                onChange={(instanceName) =>
                  onUpdateNode(workflowId, node.id, (current) =>
                    isWorkflowActionNode(current, "BuildSql")
                      ? {
                          ...current,
                          params: {
                            ...current.params,
                            lakebaseInstanceName: instanceName,
                            lakebaseAppResourceName: "database",
                            lakebaseDatabaseName: DEFAULT_PROVISIONED_DATABASE,
                          },
                        }
                      : current,
                  )
                }
              />
            )}
          {!isStandaloneWorkspace && <Label className="text-sm">Lakebase app resource</Label>}
          {!isStandaloneWorkspace && lakebaseResourceOptions.length === 0 ? (
            <p className="text-xs text-warning-foreground">
              {node.params.sqlSourceKind === "lakebaseAutoscaling"
                ? "No Lakebase Autoscaling resources are attached to this app. Add one in App Settings > Resources."
                : "No provisioned Lakebase resources are attached to this app. Add one in App Settings > Resources."}
            </p>
          ) : !isStandaloneWorkspace ? (
            <Select
              value={
                isUnresolvedResource(node.params.lakebaseAppResourceName)
                  ? ""
                  : (node.params.lakebaseAppResourceName ?? "")
              }
              onValueChange={(resourceName) => {
                const picked = lakebaseResourceOptions.find(
                  (resource) => resource.name === resourceName,
                );
                const databaseName =
                  picked?.database?.database_name?.trim() ?? "";
                onUpdateNode(workflowId, node.id, (current) =>
                  isWorkflowActionNode(current, "BuildSql")
                    ? {
                        ...current,
                        params: {
                          ...current.params,
                          lakebaseAppResourceName: resourceName || undefined,
                          lakebaseDatabaseName: databaseName || undefined,
                          ...(node.params.sqlSourceKind ===
                          "lakebaseProvisionedDatabase"
                            ? {
                                lakebaseInstanceName:
                                  picked?.database?.instance_name ||
                                  node.params.lakebaseInstanceName,
                              }
                            : {}),
                          ...(node.params.sqlSourceKind === "lakebaseAutoscaling"
                            ? {
                                lakebaseProjectId: undefined,
                                lakebaseBranchId: undefined,
                                lakebaseEndpointId: undefined,
                              }
                            : {}),
                        },
                      }
                    : current,
                );
              }}
            >
              <SelectTrigger className="h-9 bg-card text-sm">
                <SelectValue placeholder="Select attached resource..." />
              </SelectTrigger>
              <SelectContent>
                {lakebaseResourceOptions.map((resource) => (
                  <SelectItem key={resource.name} value={resource.name}>
                    {resource.name}
                    {resource.database?.database_name
                      ? ` — ${resource.database.database_name}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {!isStandaloneWorkspace && node.params.lakebaseAppResourceName &&
          node.params.lakebaseDatabaseName ? (
            <p className="text-xs text-muted-foreground">
              Database{" "}
              <span className="font-mono">
                {node.params.lakebaseDatabaseName}
              </span>{" "}
              is taken from the resource metadata and emitted in generated{" "}
              <span className="font-mono">app.yaml</span>.
            </p>
          ) : null}
          {isStandaloneWorkspace &&
          node.params.sqlSourceKind === "lakebaseProvisionedDatabase" ? (
            <p className="text-xs text-muted-foreground">
              The generated child App will bind the existing instance’s
              `databricks_postgres` database as its `database` resource. Each
              viewer needs the postgres scope and a Lakebase role with the
              required grants.
            </p>
          ) : null}
          {node.params.sqlSourceKind === "lakebaseAutoscaling" ? (
            <BuildSqlAutoscalingWorkspaceFields
              workflowId={workflowId}
              node={node}
              onUpdateNode={onUpdateNode}
            />
          ) : null}
        </div>
      )}
    </>
  );
};

export default BuildSqlInstalledResourceFields;
