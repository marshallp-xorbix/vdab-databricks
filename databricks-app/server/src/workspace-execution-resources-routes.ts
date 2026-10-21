const JOBS_PATH = "/api/v1/workspace/resources/jobs";
const SQL_WAREHOUSES_PATH = "/api/v1/workspace/resources/sql-warehouses";

export type WorkspaceExecutionResourcesRoute =
  | { type: "jobs" }
  | { type: "sqlWarehouses" };

/** Matches read-only workflow resource endpoints with no caller authority input. */
export function matchWorkspaceExecutionResourcesRoute(
  method: string,
  requestUrl: URL,
): WorkspaceExecutionResourcesRoute | null {
  if (method !== "GET" || requestUrl.search !== "") return null;
  if (requestUrl.pathname === JOBS_PATH) return { type: "jobs" };
  if (requestUrl.pathname === SQL_WAREHOUSES_PATH) return { type: "sqlWarehouses" };
  return null;
}
