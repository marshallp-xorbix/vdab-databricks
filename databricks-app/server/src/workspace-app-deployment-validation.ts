import { ApplicationError } from "./application-error.ts";
export { normalizeWorkspaceHost } from "./workspace-host.ts";

const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;
const SUPPORTED_API_USER_SCOPES = [
  "ai-functions",
  "ai-gateway",
  "apps",
  "files",
  "genie",
  "model-serving",
  "postgres",
  "sql",
  "vector-search",
  "sql:restricted-query",
] as const;
const SUPPORTED_SDK_USER_SCOPES = [
  "catalog.catalogs",
  "catalog.connections",
  "catalog.schemas",
  "catalog.tables",
  "workspace.workspace",
] as const;
const SUPPORTED_APP_SPACE_USER_SCOPES = [
  "mcp.external",
  "mcp.functions",
] as const;
const SUPPORTED_USER_API_SCOPES = new Set([
  ...SUPPORTED_API_USER_SCOPES,
  ...SUPPORTED_SDK_USER_SCOPES,
  ...SUPPORTED_APP_SPACE_USER_SCOPES,
  ...SUPPORTED_SDK_USER_SCOPES.map((scope) => `${scope}:read`),
]);

/** Validates that generated source is stored in VDAB's per-user deployment area. */
export function validateDeploymentSourcePath(sourceCodePath: string): void {
  if (
    !sourceCodePath.startsWith("/Workspace/Users/") ||
    !sourceCodePath.includes("/.vdab/deployments/") ||
    sourceCodePath.split("/").some((part) => part === "..")
  ) {
    throw new ApplicationError(
      400,
      "invalid_deployment_source_path",
      "Invalid deployment source path",
      "Generated app source must be stored in VDAB's controlled per-user deployment folder.",
    );
  }
}

/** Validates the name used for a Databricks App or App Space. */
export function validateAppName(appName: string): void {
  if (!APP_NAME_PATTERN.test(appName)) {
    throw new ApplicationError(
      400,
      "invalid_child_app_name",
      "Invalid Databricks App name",
      "App names must be 2–30 lowercase letters, numbers, or hyphens and begin and end with a letter or number.",
    );
  }
}

/** Validates and normalizes the scopes requested by a generated child App. */
export function validateUserApiScopes(scopes: string[]): string[] {
  if (scopes.some((scope) => !SUPPORTED_USER_API_SCOPES.has(scope))) {
    throw new ApplicationError(
      400,
      "unsupported_child_app_scope",
      "App authorization scope is unsupported",
      "The child App requires a user authorization scope that Databricks Apps does not currently list as supported.",
    );
  }
  return [...new Set(scopes)].sort();
}
