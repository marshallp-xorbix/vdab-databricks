import type {
  ProjectChildAppMode,
  ProjectDeploymentSourceFile,
  ProjectDeploymentStatus,
  ProjectDeploymentSummary,
  WorkspaceAppResource,
} from "../contracts.ts";
import { MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH } from "../contracts.ts";
import type {
  ProjectChildAppRecord,
  ProjectDeploymentRecord,
} from "./project-deployment-repository.ts";

export interface DeploymentRow extends Record<string, unknown> {
  id: string;
  project_id: string;
  app_name: string | null;
  mode: ProjectChildAppMode | null;
  source_version: number;
  source_snapshot: unknown;
  databricks_deployment_id: string | null;
  source_code_path: string | null;
  status: ProjectDeploymentStatus;
  failure_code: string | null;
  attempt_of: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
  app_id: string | null;
  required_user_api_scopes: unknown;
  required_app_resources: unknown;
  link_mode: ProjectChildAppMode | null;
  linked_source_path: string | null;
}

export interface ChildAppRow extends Record<string, unknown> {
  workspace_app_id: string | null;
  app_name: string;
  link_mode: ProjectChildAppMode;
  source_code_path: string | null;
  create_marker: string | null;
}

export const DEPLOYMENT_SELECT = `SELECT deployment.id, deployment.project_id,
       COALESCE(deployment.app_name, child.app_name) AS app_name,
       child.link_mode AS mode,
       deployment.source_version, deployment.source_snapshot,
       deployment.databricks_deployment_id, deployment.source_code_path,
       deployment.status, deployment.failure_code, deployment.attempt_of,
       deployment.created_at, deployment.completed_at,
       deployment.required_user_api_scopes,
       deployment.required_app_resources,
       child.workspace_app_id AS app_id, child.link_mode,
       child.source_code_path AS linked_source_path
FROM vdab_project_deployments deployment
LEFT JOIN vdab_project_child_apps child ON child.project_id = deployment.project_id`;

/** Adds a parameterized optional assignment for a repository update statement. */
export function addDeploymentUpdateValue(
  set: string[],
  values: unknown[],
  column: string,
  value: unknown,
): void {
  if (value === undefined) return;
  values.push(value);
  set.push(`${column} = $${values.length}`);
}

/** Maps the database child-app row into its private repository representation. */
export function toChildAppRecord(row: ChildAppRow): ProjectChildAppRecord {
  return {
    appId:
      typeof row.workspace_app_id === "string" ? row.workspace_app_id : null,
    appName: row.app_name,
    mode: row.link_mode,
    sourceCodePath:
      typeof row.source_code_path === "string" ? row.source_code_path : null,
    createMarker:
      typeof row.create_marker === "string" ? row.create_marker : null,
  };
}

/** Maps a private database row and its child link to a recovery record. */
export function toDeploymentRecord(
  row: DeploymentRow,
  mode: ProjectChildAppMode | null,
  linkMode: ProjectChildAppMode | null,
  appId: string | null,
  linkedSourcePath: string | null,
): ProjectDeploymentRecord {
  const childAppMode = mode ?? linkMode;
  if (!childAppMode)
    throw new Error("Deployment history has no child-App link mode.");
  return {
    id: row.id,
    projectId: row.project_id,
    appName: row.app_name ?? "",
    mode: childAppMode,
    sourceVersion: Number(row.source_version),
    status: row.status,
    deploymentId: row.databricks_deployment_id,
    sourceCodePath: row.source_code_path ?? linkedSourcePath,
    failureCode: row.failure_code,
    attemptOf: row.attempt_of,
    createdAt: toIsoString(row.created_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : null,
    sourceFiles: readDeploymentSourceFiles(row.source_snapshot),
    appId,
    requiredUserApiScopes: readDeploymentScopeArray(
      row.required_user_api_scopes,
    ),
    requiredAppResources: readDeploymentAppResourceArray(
      row.required_app_resources,
    ),
  };
}

/** Removes source contents and private authorization details from list responses. */
export function toDeploymentSummary(
  record: ProjectDeploymentRecord,
): ProjectDeploymentSummary {
  return {
    id: record.id,
    projectId: record.projectId,
    appName: record.appName,
    mode: record.mode,
    sourceVersion: record.sourceVersion,
    status: record.status,
    deploymentId: record.deploymentId,
    sourceCodePath: record.sourceCodePath,
    failureCode: record.failureCode,
    attemptOf: record.attemptOf,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}

/** Parses the private immutable source snapshot retained for retry and rollback. */
export function readDeploymentSourceFiles(
  value: unknown,
): ProjectDeploymentSourceFile[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(parsed))
    throw new Error("Deployment source snapshot is invalid.");
  return parsed.map((file) => {
    if (
      typeof file !== "object" ||
      file === null ||
      Array.isArray(file) ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    ) {
      throw new Error("Deployment source snapshot is invalid.");
    }
    return { path: file.path, content: file.content };
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("Deployment source snapshot is invalid.");
  }
}

export function readDeploymentScopeArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (
    !Array.isArray(parsed) ||
    parsed.some((scope) => typeof scope !== "string")
  ) {
    throw new Error("Deployment authorization scope snapshot is invalid.");
  }
  return parsed as string[];
}

/** Parses the private immutable App resource bindings retained for recovery. */
export function readDeploymentAppResourceArray(
  value: unknown,
): WorkspaceAppResource[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(parsed) || parsed.length > 100) {
    throw new Error("Deployment App resource snapshot is invalid.");
  }
  const resources = parsed.map(readDeploymentAppResource);
  if (
    new Set(resources.map((resource) => resource.name)).size !==
    resources.length
  ) {
    throw new Error("Deployment App resource snapshot is invalid.");
  }
  return resources;
}

function readDeploymentAppResource(value: unknown): WorkspaceAppResource {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !/^[a-z][a-z0-9-]{0,29}$/.test(value.name) ||
    typeof value.description !== "string" ||
    value.description.length > 50
  ) {
    throw new Error("Deployment App resource snapshot is invalid.");
  }
  if (
    isRecord(value.postgres) &&
    exactKeys(value, ["name", "description", "postgres"]) &&
    /^vdab-pg-[a-f0-9]{16}$/.test(value.name) &&
    exactKeys(value.postgres, ["database", "permission"]) &&
    typeof value.postgres.database === "string" &&
    /^projects\/[A-Za-z0-9_-]{1,128}\/branches\/[A-Za-z0-9_-]{1,128}\/databases\/[A-Za-z0-9_-]{1,128}$/.test(
      value.postgres.database,
    ) &&
    value.postgres.permission === "CAN_CONNECT_AND_CREATE"
  ) {
    return {
      name: value.name,
      description: value.description,
      postgres: {
        database: value.postgres.database,
        permission: "CAN_CONNECT_AND_CREATE",
      },
    };
  }
  if (
    isRecord(value.sql_warehouse) &&
    exactKeys(value, ["name", "description", "sql_warehouse"]) &&
    /^vdab-wh-[a-f0-9]{16}$/.test(value.name) &&
    exactKeys(value.sql_warehouse, ["id", "permission"]) &&
    typeof value.sql_warehouse.id === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value.sql_warehouse.id) &&
    value.sql_warehouse.permission === "CAN_USE"
  ) {
    return {
      name: value.name,
      description: value.description,
      sql_warehouse: {
        id: value.sql_warehouse.id,
        permission: "CAN_USE",
      },
    };
  }
  if (
    isRecord(value.secret) &&
    exactKeys(value, ["name", "description", "secret"]) &&
    exactKeys(value.secret, ["scope", "key", "permission"]) &&
    typeof value.secret.scope === "string" &&
    isBoundedSecretIdentifier(value.secret.scope) &&
    typeof value.secret.key === "string" &&
    isBoundedSecretIdentifier(value.secret.key) &&
    value.secret.permission === "READ"
  ) {
    return {
      name: value.name,
      description: value.description,
      secret: {
        scope: value.secret.scope,
        key: value.secret.key,
        permission: "READ",
      },
    };
  }
  if (
    isRecord(value.database) &&
    exactKeys(value, ["name", "description", "database"]) &&
    /^vdab-db-[a-f0-9]{16}$/.test(value.name) &&
    exactKeys(value.database, [
      "instance_name",
      "database_name",
      "permission",
    ]) &&
    typeof value.database.instance_name === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value.database.instance_name) &&
    typeof value.database.database_name === "string" &&
    /^[A-Za-z0-9_$-]{1,63}$/.test(value.database.database_name) &&
    value.database.permission === "CAN_CONNECT_AND_CREATE"
  ) {
    return {
      name: value.name,
      description: value.description,
      database: {
        instance_name: value.database.instance_name,
        database_name: value.database.database_name,
        permission: "CAN_CONNECT_AND_CREATE",
      },
    };
  }
  throw new Error("Deployment App resource snapshot is invalid.");
}

function isBoundedSecretIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function exactKeys(
  value: Record<string, unknown>,
  expected: string[],
): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTerminalDeploymentStatus(
  status: ProjectDeploymentStatus,
): boolean {
  return (
    status === "succeeded" || status === "failed" || status === "cancelled"
  );
}

function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
