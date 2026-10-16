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
}

export interface BuildSqlResult {
  sql: string;
  sqlSourceKind: WorkflowSqlSourceKind;
}
