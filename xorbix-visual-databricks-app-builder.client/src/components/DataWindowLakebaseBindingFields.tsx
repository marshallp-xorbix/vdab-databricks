import InstalledWorkspaceLakebaseProvisionedTableSelectorFields from "./InstalledWorkspaceLakebaseProvisionedTableSelectorFields";
import InstalledWorkspaceLakebaseTableSelectorFields from "./InstalledWorkspaceLakebaseTableSelectorFields";
import type { IWorkspaceLakebaseTable } from "../models/WorkspaceLakebaseResources";
import type { IProjectTableBinding, ProjectTableBindingKind } from "../utils/projectDataWindowBinding";
import {
  createLakebaseAutoscalingTableBinding,
  createLakebaseProvisionedTableBinding,
} from "../utils/projectDataWindowBinding";
import type { LakebaseAutoscalingTableRef, LakebaseTableRef } from "../types/workflow/sharedReferences";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface IDataWindowLakebaseBindingFieldsProps {
  kind: Extract<ProjectTableBindingKind, "lakebaseAutoscaling" | "lakebaseProvisionedDatabase">;
  binding: IProjectTableBinding | null;
  onBindingsChange: (bindings: ProjectJsonObject) => void;
}

/** Edits installed-workspace Lakebase table bindings for the component editors. */
export default function DataWindowLakebaseBindingFields({
  kind,
  binding,
  onBindingsChange,
}: Readonly<IDataWindowLakebaseBindingFieldsProps>) {
  if (kind === "lakebaseAutoscaling") {
    const value: LakebaseAutoscalingTableRef = {
      tableType: "lakebaseAutoscaling",
      workspaceConnectionId: 0,
      projectId: binding?.kind === kind ? binding.projectId ?? "" : "",
      branchId: binding?.kind === kind ? binding.branchId ?? "" : "",
      endpointId: binding?.kind === kind ? binding.endpointId ?? "" : "",
      databaseId: binding?.kind === kind ? binding.databaseId ?? "" : "",
      database: binding?.kind === kind ? binding.database ?? "" : "",
      catalog: binding?.kind === kind ? binding.database ?? "" : "",
      schema: binding?.kind === kind ? binding.schema ?? "" : "",
      table: binding?.kind === kind ? binding.table ?? "" : "",
    };
    return (
      <InstalledWorkspaceLakebaseTableSelectorFields
        value={value}
        onChange={(next, table) => onBindingsChange(createLakebaseAutoscalingTableBinding(
          toBindingSelection(kind, next, table),
        ))}
      />
    );
  }

  const value: LakebaseTableRef = {
    tableType: "lakebaseProvisionedDatabase",
    workspaceConnectionId: 0,
    instanceName: binding?.kind === kind ? binding.instanceName ?? "" : "",
    database: binding?.kind === kind ? binding.database ?? "databricks_postgres" : "databricks_postgres",
    catalog: binding?.kind === kind ? binding.database ?? "databricks_postgres" : "databricks_postgres",
    schema: binding?.kind === kind ? binding.schema ?? "" : "",
    table: binding?.kind === kind ? binding.table ?? "" : "",
  };
  return (
    <InstalledWorkspaceLakebaseProvisionedTableSelectorFields
      value={value}
      onChange={(next, table) => onBindingsChange(createLakebaseProvisionedTableBinding(
        toBindingSelection(kind, next, table),
      ))}
    />
  );
}

function toBindingSelection(
  kind: "lakebaseAutoscaling" | "lakebaseProvisionedDatabase",
  value: LakebaseAutoscalingTableRef | LakebaseTableRef,
  table: IWorkspaceLakebaseTable | null | undefined,
): IProjectTableBinding {
  const lakebaseTable = table?.tableType === "BASE TABLE" ? table : null;
  const isAutoscaling = kind === "lakebaseAutoscaling";
  const autoscalingValue = isAutoscaling ? value as LakebaseAutoscalingTableRef : null;
  const provisionedValue = isAutoscaling ? null : value as LakebaseTableRef;
  const database = isAutoscaling ? autoscalingValue?.database ?? null : provisionedValue?.database ?? null;
  return {
    kind,
    catalog: database,
    schema: isAutoscaling ? autoscalingValue?.schema || null : provisionedValue?.schema || null,
    table: isAutoscaling ? autoscalingValue?.table || null : provisionedValue?.table || null,
    dataSourceFormat: null,
    primaryKeyColumn: null,
    columns: (lakebaseTable?.columns ?? []).map((column) => ({
      name: column.name,
      type: column.type,
      dataType: column.type,
    })),
    database,
    instanceName: provisionedValue?.instanceName ?? null,
    projectId: autoscalingValue?.projectId ?? null,
    branchId: autoscalingValue?.branchId ?? null,
    endpointId: autoscalingValue?.endpointId ?? null,
    databaseId: autoscalingValue?.databaseId ?? null,
  };
}
