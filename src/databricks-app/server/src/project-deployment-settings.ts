import type { ProjectDeploymentSettings } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

const MAX_WORKSPACE_PATH_LENGTH = 1024;
const WORKSPACE_PATH_PREFIX = "/Workspace/";

/** Validates a folder within the installed workspace without accepting workspace authority. */
export function readProjectWorkspacePath(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw invalidDeploymentSettings();
  const path = value.trim().replace(/\/+$/, "");
  if (
    !path.startsWith(WORKSPACE_PATH_PREFIX) ||
    path.length > MAX_WORKSPACE_PATH_LENGTH ||
    path
      .split("/")
      .slice(1)
      .some((part) => !part || part === "." || part === "..") ||
    /[\\\u0000-\u001f\u007f?#%]/.test(path)
  )
    throw invalidDeploymentSettings();
  return path;
}

/** Reads persisted or requested deployment settings with exact nested keys. */
export function readProjectDeploymentSettings(
  value: unknown,
): ProjectDeploymentSettings | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value))
    throw invalidDeploymentSettings();
  const settings = value as Record<string, unknown>;
  if (
    Object.keys(settings).some(
      (key) => !["mode", "appName", "workspacePath"].includes(key),
    ) ||
    (settings.mode !== "createNew" && settings.mode !== "linkExisting") ||
    typeof settings.appName !== "string" ||
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(settings.appName)
  ) {
    throw invalidDeploymentSettings();
  }
  return {
    mode: settings.mode,
    appName: settings.appName,
    workspacePath: readProjectWorkspacePath(settings.workspacePath),
  };
}

function invalidDeploymentSettings(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_project_deployment_settings",
    "Invalid deployment settings",
    "Choose a valid Databricks App target and an absolute /Workspace/ folder without traversal or URL characters.",
  );
}
