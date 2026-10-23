/** Current fixed Databricks Apps limit per workspace. */
export const MAX_APPS_PER_WORKSPACE = 100;
export const MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH = 128;
export const MAX_CHILD_APP_SECRET_RESOURCES = 100;
export const CHILD_APP_SECRET_RESOURCE_DESCRIPTION =
  "VDAB secret read binding";
export const CHILD_APP_SECRET_ENVIRONMENT_PREFIX = "VDAB_SECRET_";

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

/** Production collaborator grants stay disabled until a supported directory lookup exists. */
export const PROJECT_COLLABORATOR_DIRECTORY_UNAVAILABLE_CODE =
  "collaborator_identity_directory_unavailable";

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

/** Deployment source mode selected by the project editor. */
export type ProjectChildAppMode = "createNew" | "linkExisting";

/** Lifecycle state recorded for one immutable generated source snapshot. */
export type ProjectDeploymentStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** One generated source file saved with a deployment for recovery. */
export interface ProjectDeploymentSourceFile {
  path: string;
  content: string;
}

/** Safe child-App link returned with project deployment history. */
export interface ProjectChildAppLink {
  appId: string | null;
  appName: string;
  mode: ProjectChildAppMode;
  sourceCodePath: string | null;
}

/** Safe deployment history item; source contents never leave Lakebase. */
export interface ProjectDeploymentSummary {
  id: string;
  projectId: string;
  appName: string;
  mode: ProjectChildAppMode;
  sourceVersion: number;
  status: ProjectDeploymentStatus;
  deploymentId: string | null;
  sourceCodePath: string | null;
  failureCode: string | null;
  attemptOf: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Project child-App link and recent deployment history. */
export interface ProjectDeploymentHistory {
  childApp: ProjectChildAppLink | null;
  items: ProjectDeploymentSummary[];
}

/** Project-specific scopes and unsupported workflow operations found before deployment. */
export interface ProjectDeploymentReadiness {
  userApiScopes: string[];
  appResources: WorkspaceAppResource[];
  blockers: Array<{ code: string; detail: string }>;
}

/** Existing Lakebase resource Databricks must bind to a generated child App. */
export type WorkspaceAppResource =
  | WorkspaceLakebaseAppResource
  | WorkspaceSqlWarehouseAppResource
  | WorkspaceSecretAppResource;

export type WorkspaceLakebaseAppResource =
  | {
      name: string;
      description: string;
      postgres: {
        database: string;
        permission: "CAN_CONNECT_AND_CREATE";
      };
    }
  | {
      name: string;
      description: string;
      database: {
        instance_name: string;
        database_name: string;
        permission: "CAN_CONNECT_AND_CREATE";
      };
    };

export interface WorkspaceSqlWarehouseAppResource {
  name: string;
  description: string;
  sql_warehouse: {
    id: string;
    permission: "CAN_USE" | "CAN_MANAGE" | "IS_OWNER";
  };
}

/** Secret scope binding attached to a generated or linked child App. */
export interface WorkspaceSecretAppResource {
  name: string;
  description: string;
  secret: {
    scope: string;
    key: string;
    permission: "READ" | "WRITE" | "MANAGE";
  };
}

/** Secret identifiers chosen for a generated child App; this never contains a value. */
export interface WorkspaceSecretResourceSelection {
  name: string;
  scope: string;
  key: string;
}

/** Result of creating or refreshing one Databricks App deployment. */
export interface WorkspaceAppDeploymentStatus {
  deploymentId: string;
  state: "pending" | "running" | "succeeded" | "failed" | "cancelled";
}

/** Safe current deployment details for a workspace App selected for linking. */
export interface WorkspaceAppDeploymentTarget {
  appId: string | null;
  name: string;
  description: string | null;
  spaceName: string | null;
  effectiveUserApiScopes: string[] | null;
  appState: string | null;
  computeState: string | null;
  appUrl: string | null;
  activeDeploymentId: string | null;
  sourceCodePath: string | null;
  usesGitSource: boolean;
  userApiScopes: string[];
  secretResources: WorkspaceSecretAppResource[];
}

/** Safe name exposed for a resource visible to the current workspace user. */
export interface WorkspaceResource {
  name: string;
}

/** Table metadata visible to the current Databricks user. */
export interface WorkspaceTableResource extends WorkspaceResource {
  dataSourceFormat: string | null;
  columns: Array<{
    name: string;
    type: string | null;
    dataType: string | null;
  }>;
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

/** Lakebase Provisioned instance visible to the acting Databricks user. */
export interface WorkspaceLakebaseProvisionedInstanceResource {
  instanceName: string;
  state: string | null;
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

/** Safe summary of install-local resources and the caller's optional authorization check. */
export interface WorkspaceSetupDiagnostics {
  lakebase: {
    status: "configured" | "incomplete" | "missing" | "local-test";
    configuredFields: string[];
    missingFields: string[];
    message: string;
  };
  defaultSqlWarehouse: {
    status: "configured" | "invalid" | "missing" | "local-test";
    message: string;
  };
  authorization: {
    status: "verified" | "missing-scopes" | "unavailable" | "local-test";
    requestedScopes: string[];
    effectiveScopes: string[];
    consentedScopes: string[];
    missingScopes: string[];
    message: string;
  };
}
