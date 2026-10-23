import type {
  BuildSqlPlaceholderReference,
  WorkflowSqlSourceKind,
} from "../sharedReferences";

export interface BuildSqlParams {
  sqlSourceKind: WorkflowSqlSourceKind;
  sqlTemplate: string;
  placeholders: BuildSqlPlaceholderReference[];
  /** Databricks App resource name (App Settings) when using Lakebase source kinds. */
  lakebaseAppResourceName?: string;
  /** Postgres database name for the selected Lakebase resource. */
  lakebaseDatabaseName?: string;
  /** Current-workspace Autoscaling database ID used to bind a child App resource. */
  lakebaseDatabaseId?: string;
  /** Current-workspace Provisioned instance for caller-scoped credentials. */
  lakebaseInstanceName?: string;
  /** Current-workspace Autoscaling endpoint components for user-scoped credentials. */
  lakebaseProjectId?: string;
  lakebaseBranchId?: string;
  lakebaseEndpointId?: string;
  /** Current-workspace SQL warehouse selected for viewer-authorized execution. */
  sqlWarehouseId?: string;
  /** Display name paired with the current-workspace SQL warehouse ID. */
  sqlWarehouseName?: string;
}

export interface BuildSqlResult {
  sql: string;
  sqlSourceKind: WorkflowSqlSourceKind;
}
