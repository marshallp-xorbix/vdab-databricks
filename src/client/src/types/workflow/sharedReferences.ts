export type WorkflowValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "unknown";

export type BuildSqlFormatHint =
  | "raw"
  | "sqlStringLiteral"
  | "sqlIdentifier"
  | "dateLiteral";

export type WorkflowSqlSourceKind =
  | "unityCatalogTable"
  | "lakebaseProvisionedDatabase"
  | "lakebaseAutoscaling";

export interface DatabricksJobResourceRef {
  resourceType: "databricksJob";
  jobId: string;
  jobName: string;
}

export interface UnityCatalogTableRef {
  tableType: "unityCatalogTable";
  catalog: string;
  schema: string;
  table: string;
}

export interface LakebaseTableRef {
  tableType: "lakebaseProvisionedDatabase";
  instanceName: string;
  database: string;
  catalog: string;
  schema: string;
  table: string;
}

/** Lakebase Autoscaling Postgres project/branch/endpoint + synced UC table target. */
export interface LakebaseAutoscalingTableRef {
  tableType: "lakebaseAutoscaling";
  projectId: string;
  branchId: string;
  endpointId: string;
  databaseId: string;
  database: string;
  catalog: string;
  schema: string;
  table: string;
}

export type SaveTargetTableRef =
  | UnityCatalogTableRef
  | LakebaseTableRef
  | LakebaseAutoscalingTableRef;

export function isLakebaseAutoscalingTableRef(
  ref: SaveTargetTableRef,
): ref is LakebaseAutoscalingTableRef {
  return ref.tableType === "lakebaseAutoscaling";
}

export interface BuildSqlPlaceholderReference {
  token: string;
  componentCodeName: string;
  valueType: WorkflowValueType;
  formatHint?: BuildSqlFormatHint;
}
