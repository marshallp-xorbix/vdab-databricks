/** Identity established at the Databricks App proxy boundary. */
export interface CallerIdentity {
  userId: string;
  preferredUsername: string | null;
  email: string | null;
  workspaceId: string | null;
  authenticationMode: "databricks" | "local-test";
  /** True only when the caller ID appears in the install-admin configuration. */
  isInstallationAdmin: boolean;
  /** Forwarded caller token for same-workspace APIs. Never serialize or log this field. */
  databricksAccessToken: string | null;
}

/** A project summary filtered through the caller's project ACL. */
export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  callerRole: "owner" | "editor" | "viewer" | "installationAdmin";
}

/** A collaborator granted project-level editor access. */
export interface ProjectCollaborator {
  userId: string;
  role: "editor";
  grantedBy: string;
  createdAt: string;
}

/** Safe summary of one App visible in the installed workspace. */
export interface WorkspaceAppSummary {
  name: string;
  description: string | null;
  appState: string | null;
  computeState: string | null;
}

/** One page of apps returned by the caller-authorized workspace API. */
export interface WorkspaceAppsPage {
  items: WorkspaceAppSummary[];
  nextPageToken: string | null;
  authenticationMode: "databricks" | "local-test";
}

/** Safe name exposed for a resource visible to the current workspace user. */
export interface WorkspaceResource {
  name: string;
}

/** Table metadata visible to the current Databricks user. */
export interface WorkspaceTableResource extends WorkspaceResource {
  dataSourceFormat: string | null;
  columns: Array<{ name: string; type: string | null; dataType: string | null }>;
}

/** One Unity Catalog table name returned without column metadata. */
export interface WorkspaceTableSummaryResource {
  fullName: string;
}

/** One resource list resolved in the workspace hosting this app. */
export interface WorkspaceResourcesPage {
  items: WorkspaceResource[];
  authenticationMode: "databricks" | "local-test";
}

/** One page of table metadata resolved from the installed workspace. */
export interface WorkspaceTablesPage {
  items: WorkspaceTableResource[];
  authenticationMode: "databricks" | "local-test";
}

/** Bounded Unity Catalog table summaries and whether more rows are available. */
export interface WorkspaceTableSummariesPage {
  items: WorkspaceTableSummaryResource[];
  hasMore: boolean;
  authenticationMode: "databricks" | "local-test";
}

/** Bounded table summaries returned by the workspace adapter. */
export interface WorkspaceTableSummariesResult {
  items: WorkspaceTableSummaryResource[];
  hasMore: boolean;
}

/** Genie space visible to the acting user in the installed workspace. */
export interface WorkspaceGenieSpaceResource {
  spaceId: string;
  title: string;
}

/** Genie spaces returned by the caller-authorized Genie API. */
export interface WorkspaceGenieSpacesPage {
  items: WorkspaceGenieSpaceResource[];
  authenticationMode: "databricks" | "local-test";
}

/** Serving endpoint summary visible to the acting user in this workspace. */
export interface WorkspaceServingEndpointResource {
  name: string;
  readiness: "ready" | "not-ready" | "unknown";
  permissionLevel: "CAN_VIEW" | "CAN_QUERY" | "CAN_MANAGE" | null;
}

/** Serving endpoints returned by the caller-authorized workspace API. */
export interface WorkspaceServingEndpointsPage {
  items: WorkspaceServingEndpointResource[];
  authenticationMode: "databricks" | "local-test";
}

/** Job that the acting Databricks user can see in the installed workspace. */
export interface WorkspaceJobResource {
  jobId: string;
  name: string;
}

/** SQL warehouse that the acting Databricks user can see in this workspace. */
export interface WorkspaceSqlWarehouseResource {
  id: string;
  name: string;
  state: "running" | "stopped" | "starting" | "stopping" | "unknown";
}

/** Jobs returned by caller-authorized current-workspace discovery. */
export interface WorkspaceJobsPage {
  items: WorkspaceJobResource[];
  authenticationMode: "databricks" | "local-test";
}

/** SQL warehouses returned by caller-authorized current-workspace discovery. */
export interface WorkspaceSqlWarehousesPage {
  items: WorkspaceSqlWarehouseResource[];
  authenticationMode: "databricks" | "local-test";
}

/** Lakebase Autoscaling project visible to the acting Databricks user. */
export interface WorkspaceLakebaseProjectResource {
  projectId: string;
  displayName: string;
}

/** Lakebase branch visible to the acting Databricks user. */
export interface WorkspaceLakebaseBranchResource {
  branchId: string;
  isDefault: boolean;
  state: "ready" | "initializing" | "archived" | "unknown";
}

/** Lakebase endpoint visible to the acting Databricks user. */
export interface WorkspaceLakebaseEndpointResource {
  endpointId: string;
  endpointType: "read-write" | "read-only";
  state: "active" | "idle" | "initializing" | "degraded" | "unknown";
}

/** PostgreSQL database visible on one Lakebase branch. */
export interface WorkspaceLakebaseDatabaseResource {
  databaseId: string;
  databaseName: string;
}

/** PostgreSQL table and columns visible to the acting user. */
export interface WorkspaceLakebaseTableResource {
  name: string;
  tableType: "BASE TABLE" | "VIEW";
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

/** One Lakebase resource list resolved in the installed workspace. */
export interface WorkspaceLakebaseResourcesPage<T> {
  items: T[];
  authenticationMode: "databricks" | "local-test";
}

/** Public, token-free representation of the current session. */
export interface SessionResponse {
  userId: string;
  preferredUsername: string | null;
  email: string | null;
  workspace: {
    id: string | null;
    host: string | null;
  };
  authenticationMode: "databricks" | "local-test";
  installationAdmin: boolean;
}
