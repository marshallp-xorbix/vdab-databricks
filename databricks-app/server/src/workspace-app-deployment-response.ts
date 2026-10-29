import type {
  WorkspaceAppDeploymentStatus,
  WorkspaceAppResource,
} from "./contracts.ts";
import { MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import type { WorkspaceAppDetails } from "./workspace-app-deployment-client.ts";

interface ApiObject extends Record<string, unknown> {}

/** Maps a bounded Databricks Apps response to the safe editor target contract. */
export function parseWorkspaceAppResponse(value: unknown): WorkspaceAppDetails {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw invalidDatabricksResponse();
  }
  if (!Object.hasOwn(value, "space")) {
    throw invalidDatabricksResponse();
  }
  return {
    appId: typeof value.id === "string" ? value.id : null,
    name: value.name,
    description:
      typeof value.description === "string" ? value.description : null,
    spaceName: readAppSpaceName(value.space),
    effectiveUserApiScopes: readOptionalStringArray(
      value.effective_user_api_scopes,
    ),
    appState: readNestedState(value.app_status),
    computeState: readNestedState(value.compute_status),
    appUrl: readHttpsAppUrl(value.url),
    activeDeploymentId: readNestedString(
      value.active_deployment,
      "deployment_id",
    ),
    sourceCodePath:
      readNestedString(value.active_deployment, "source_code_path") ??
      (typeof value.default_source_code_path === "string"
        ? value.default_source_code_path
        : null),
    usesGitSource:
      hasGitSource(value.default_git_source) ||
      hasGitSource(value.git_repository) ||
      hasGitSource(readNestedValue(value.active_deployment, "git_source")),
    userApiScopes: readStringArray(value.user_api_scopes),
    ...readWorkspaceAppResources(value.resources),
  };
}

function readAppSpaceName(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(value)
  ) {
    throw invalidDatabricksResponse();
  }
  return value;
}

function readOptionalStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw invalidDatabricksResponse();
  }
  return value as string[];
}

/** Maps Databricks' deployment states to the local lifecycle contract. */
export function parseWorkspaceAppDeploymentResponse(
  value: unknown,
): WorkspaceAppDeploymentStatus {
  if (!isRecord(value) || typeof value.deployment_id !== "string") {
    throw invalidDatabricksResponse();
  }
  const rawState = isRecord(value.status) ? value.status.state : null;
  const state =
    rawState === "SUCCEEDED"
      ? "succeeded"
      : rawState === "FAILED"
        ? "failed"
        : rawState === "CANCELLED"
          ? "cancelled"
          : rawState === "IN_PROGRESS"
            ? "running"
            : null;
  if (!state) throw invalidDatabricksResponse();
  return { deploymentId: value.deployment_id, state };
}

function readNestedState(value: unknown): string | null {
  if (isRecord(value) && typeof value.state === "string") return value.state;
  return null;
}

function hasGitSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    (typeof value.url === "string" ||
      typeof value.branch === "string" ||
      typeof value.tag === "string" ||
      typeof value.commit === "string" ||
      isRecord(value.git_repository) ||
      hasGitSource(value.git_source))
  );
}

function readNestedValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : null;
}

function readHttpsAppUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const normalizedValue = value.includes("://") ? value : `https://${value}`;
    const appUrl = new URL(normalizedValue);
    if (appUrl.protocol !== "https:" || appUrl.username || appUrl.password)
      return null;
    return appUrl.href;
  } catch {
    return null;
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))
    return [];
  return value as string[];
}

function readWorkspaceAppResources(value: unknown): {
  resources: WorkspaceAppResource[];
  unsupportedResourceCount: number;
} {
  if (value === undefined || value === null)
    return { resources: [], unsupportedResourceCount: 0 };
  if (!Array.isArray(value)) throw invalidDatabricksResponse();
  const resources: WorkspaceAppResource[] = [];
  let unsupportedResourceCount = 0;
  for (const entry of value) {
    if (!isRecord(entry)) throw invalidDatabricksResponse();
    if (entry.postgres !== undefined)
      resources.push(readAutoscalingAppResource(entry));
    else if (entry.database !== undefined)
      resources.push(readProvisionedAppResource(entry));
    else if (entry.sql_warehouse !== undefined)
      resources.push(readSqlWarehouseAppResource(entry));
    else if (entry.secret !== undefined)
      resources.push(readSecretAppResource(entry));
    else unsupportedResourceCount += 1;
  }
  return { resources, unsupportedResourceCount };
}

function readSecretAppResource(
  value: ApiObject,
): Extract<WorkspaceAppResource, { secret: unknown }> {
  if (
    typeof value.name !== "string" ||
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(value.name) ||
    !isRecord(value.secret) ||
    typeof value.secret.scope !== "string" ||
    !isBoundedSecretIdentifier(value.secret.scope) ||
    typeof value.secret.key !== "string" ||
    !isBoundedSecretIdentifier(value.secret.key) ||
    (value.secret.permission !== "READ" &&
      value.secret.permission !== "WRITE" &&
      value.secret.permission !== "MANAGE")
  ) {
    throw invalidDatabricksResponse();
  }
  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    secret: {
      scope: value.secret.scope,
      key: value.secret.key,
      permission: value.secret.permission,
    },
  };
}

function isBoundedSecretIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function readAutoscalingAppResource(
  value: ApiObject,
): Extract<WorkspaceAppResource, { postgres: unknown }> {
  if (
    typeof value.name !== "string" ||
    value.name.length < 2 ||
    value.name.length > 30 ||
    !isRecord(value.postgres) ||
    typeof value.postgres.database !== "string" ||
    !/^projects\/[A-Za-z0-9_-]{1,128}\/branches\/[A-Za-z0-9_-]{1,128}\/databases\/[A-Za-z0-9_-]{1,128}$/.test(
      value.postgres.database,
    ) ||
    value.postgres.permission !== "CAN_CONNECT_AND_CREATE"
  ) {
    throw invalidDatabricksResponse();
  }
  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    postgres: {
      database: value.postgres.database,
      permission: "CAN_CONNECT_AND_CREATE",
    },
  };
}

function readProvisionedAppResource(
  value: ApiObject,
): Extract<WorkspaceAppResource, { database: unknown }> {
  if (
    typeof value.name !== "string" ||
    value.name.length < 2 ||
    value.name.length > 30 ||
    !isRecord(value.database) ||
    typeof value.database.instance_name !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.database.instance_name) ||
    typeof value.database.database_name !== "string" ||
    !/^[A-Za-z0-9_$-]{1,63}$/.test(value.database.database_name) ||
    value.database.permission !== "CAN_CONNECT_AND_CREATE"
  ) {
    throw invalidDatabricksResponse();
  }
  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    database: {
      instance_name: value.database.instance_name,
      database_name: value.database.database_name,
      permission: "CAN_CONNECT_AND_CREATE",
    },
  };
}

function readSqlWarehouseAppResource(
  value: ApiObject,
): Extract<WorkspaceAppResource, { sql_warehouse: unknown }> {
  if (
    typeof value.name !== "string" ||
    value.name.length < 2 ||
    value.name.length > 30 ||
    !isRecord(value.sql_warehouse) ||
    typeof value.sql_warehouse.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.sql_warehouse.id) ||
    (value.sql_warehouse.permission !== "CAN_USE" &&
      value.sql_warehouse.permission !== "CAN_MANAGE" &&
      value.sql_warehouse.permission !== "IS_OWNER")
  ) {
    throw invalidDatabricksResponse();
  }
  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    sql_warehouse: {
      id: value.sql_warehouse.id,
      permission: value.sql_warehouse.permission,
    },
  };
}

function readNestedString(value: unknown, key: string): string | null {
  if (isRecord(value) && typeof value[key] === "string")
    return value[key] as string;
  return null;
}

function isRecord(value: unknown): value is ApiObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidDatabricksResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid Databricks response",
    "Databricks returned an invalid child App response.",
  );
}
