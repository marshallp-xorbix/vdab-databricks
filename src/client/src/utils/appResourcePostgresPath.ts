const POSTGRES_DATABASE_PATH =
  /^projects\/([A-Za-z0-9_-]{1,128})\/branches\/([A-Za-z0-9_-]{1,128})\/databases\/([A-Za-z0-9_-]{1,128})$/;

export interface IParsedAutoscalingPostgresPath {
  projectId: string;
  branchId: string;
  databaseId: string;
}

/** Parses a Databricks Apps postgres.database path into picker selections. */
export function parseAutoscalingPostgresDatabasePath(
  databasePath: string,
): IParsedAutoscalingPostgresPath | null {
  const match = POSTGRES_DATABASE_PATH.exec(databasePath.trim());
  if (!match) return null;
  return {
    projectId: match[1] ?? "",
    branchId: match[2] ?? "",
    databaseId: match[3] ?? "",
  };
}

/** Builds the branch path Databricks Apps expects for Autoscaling Lakebase. */
export function buildAutoscalingPostgresBranchPath(
  projectId: string,
  branchId: string,
): string {
  return `projects/${projectId}/branches/${branchId}`;
}

/** Builds the database path Databricks Apps expects for Autoscaling Lakebase. */
export function buildAutoscalingPostgresDatabasePath(
  projectId: string,
  branchId: string,
  databaseId: string,
): string {
  return `projects/${projectId}/branches/${branchId}/databases/${databaseId}`;
}
