import type {
  ProjectChildAppMode,
  WorkspaceSecretResourceSelection,
} from "../contracts.ts";
import {
  MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH,
  MAX_CHILD_APP_SECRET_RESOURCES,
} from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";

/** Validated choice for the first project-to-App association. */
export interface StartProjectDeploymentInput {
  mode: ProjectChildAppMode;
  appName: string;
  confirmOverwrite: boolean;
  secretResources: WorkspaceSecretResourceSelection[];
}

/** Validates the caller's mode, target and explicit overwrite confirmation. */
export function readStartProjectDeploymentInput(value: unknown): StartProjectDeploymentInput {
  if (!isRecord(value) || hasUnexpectedProperties(value, ["mode", "appName", "confirmOverwrite", "secretResources"])) {
    throw invalidDeploymentInput();
  }
  if (value.mode !== "createNew" && value.mode !== "linkExisting") throw invalidDeploymentInput();
  if (
    typeof value.appName !== "string" ||
    !isValidWorkspaceAppName(value.appName) ||
    typeof value.confirmOverwrite !== "boolean"
  ) {
    throw invalidDeploymentInput();
  }
  return {
    mode: value.mode,
    appName: value.appName,
    confirmOverwrite: value.confirmOverwrite,
    secretResources: readSecretResourceSelections(value.secretResources),
  };
}

function readSecretResourceSelections(
  value: unknown,
): WorkspaceSecretResourceSelection[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CHILD_APP_SECRET_RESOURCES) {
    throw invalidDeploymentInput();
  }
  const selections = value.map(readSecretResourceSelection);
  const selectionKeys = selections.map((selection) => selection.name);
  if (new Set(selectionKeys).size !== selections.length) {
    throw invalidDeploymentInput();
  }
  return selections;
}

function readSecretResourceSelection(
  value: unknown,
): WorkspaceSecretResourceSelection {
  if (!isRecord(value)) throw invalidDeploymentInput();
  if (
    hasUnexpectedProperties(value, ["name", "scope", "key"]) ||
    typeof value.name !== "string" ||
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(value.name) ||
    !isValidSecretIdentifier(value.scope) ||
    !isValidSecretIdentifier(value.key)
  ) {
    throw invalidDeploymentInput();
  }
  return { name: value.name, scope: value.scope, key: value.key };
}

function isValidSecretIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

/** Validates a current-workspace App name before an Apps API detail lookup. */
export function validateWorkspaceAppName(value: string): string {
  if (!isValidWorkspaceAppName(value)) throw invalidDeploymentInput();
  return value;
}

/** Validates a deployment ID path segment before repository access. */
export function validateProjectDeploymentId(value: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw invalidDeploymentInput();
  return value;
}

/** Requires an explicit affirmative before retry or rollback replaces an app. */
export function requireOverwriteConfirmation(value: unknown): void {
  if (!isRecord(value) || hasUnexpectedProperties(value, ["confirmOverwrite"]) || value.confirmOverwrite !== true) {
    throw new ApplicationError(
      400,
      "deployment_overwrite_confirmation_required",
      "Confirm App replacement",
      "Confirm that the selected recovery operation will replace the currently deployed child App code.",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnexpectedProperties(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function isValidWorkspaceAppName(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(value);
}

function invalidDeploymentInput(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_deployment_request",
    "Invalid deployment request",
    "Choose create new or link existing, enter a valid Databricks App name, and explicitly confirm replacement before linking an existing App.",
  );
}
