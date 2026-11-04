import type { FC } from "react";
import InstalledWorkspaceResourceSelect from "../../../../InstalledWorkspaceResourceSelect";
import { useWorkspaceSqlWarehouses } from "../../../../../hooks/useWorkspaceSqlWarehouses";
import { useWorkspaceLakebaseProvisionedInstances } from "../../../../../hooks/useWorkspaceLakebaseProvisionedInstances";
import {
  isWorkflowActionNode,
  type WorkflowActionNodeByType,
} from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import BuildSqlAutoscalingWorkspaceFields from "./BuildSqlAutoscalingWorkspaceFields";

const DEFAULT_PROVISIONED_DATABASE = "databricks_postgres";

interface IBuildSqlInstalledResourceFieldsProps {
  workflowId: string;
  node: WorkflowActionNodeByType<"BuildSql">;
  onUpdateNode: WorkflowActionEditorProps["onUpdateNode"];
}

/** Renders SQL warehouse and Lakebase selectors for the installed workspace. */
const BuildSqlInstalledResourceFields: FC<
  Readonly<IBuildSqlInstalledResourceFieldsProps>
> = ({ workflowId, node, onUpdateNode }) => {
  const sqlWarehousesQuery = useWorkspaceSqlWarehouses();
  const provisionedInstancesQuery = useWorkspaceLakebaseProvisionedInstances();

  if (!isWorkflowActionNode(node, "BuildSql")) return null;

  return (
    <>
      {node.params.sqlSourceKind === "unityCatalogTable" && (
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
            error={sqlWarehousesQuery.error}
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
            The generated RunSql action uses the current viewer’s forwarded
            Databricks authorization. Each viewer needs SQL authorization and
            warehouse access.
          </p>
        </div>
      )}

      {node.params.sqlSourceKind === "lakebaseProvisionedDatabase" && (
        <div className="space-y-1 rounded-md border border-border bg-muted/80 p-3">
          <InstalledWorkspaceResourceSelect
            label="Lakebase Provisioned instance"
            value={node.params.lakebaseInstanceName ?? ""}
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
          <p className="text-xs text-muted-foreground">
            The generated child App binds the existing instance’s
            `databricks_postgres` database as its `database` resource. Each
            viewer needs the postgres scope and a Lakebase role with the
            required grants.
          </p>
        </div>
      )}

      {node.params.sqlSourceKind === "lakebaseAutoscaling" && (
        <div className="space-y-1 rounded-md border border-border bg-muted/80 p-3">
          <BuildSqlAutoscalingWorkspaceFields
            workflowId={workflowId}
            node={node}
            onUpdateNode={onUpdateNode}
          />
        </div>
      )}
    </>
  );
};

export default BuildSqlInstalledResourceFields;
