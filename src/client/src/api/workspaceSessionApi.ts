import {
  WorkspaceSession,
  type IWorkspaceSession,
} from "../models/WorkspaceSession";

const WORKSPACE_SESSION_PATH = "/api/v1/session";

/** Loads token-free identity and workspace context from the installed VDAB app. */
export async function getWorkspaceSession(
  signal?: AbortSignal,
): Promise<IWorkspaceSession> {
  const response = await fetch(WORKSPACE_SESSION_PATH, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseWorkspaceSession(await response.json());
}

function parseWorkspaceSession(value: unknown): IWorkspaceSession {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.userId) ||
    !isNullableString(value.preferredUsername) ||
    !isNullableString(value.email) ||
    !isRecord(value.workspace) ||
    !isNullableString(value.workspace.id) ||
    !isNullableString(value.workspace.host) ||
    !isAuthenticationMode(value.authenticationMode) ||
    typeof value.installationAdmin !== "boolean"
  ) {
    throw new Error("The installed workspace returned an invalid session response.");
  }

  return new WorkspaceSession({
    userId: value.userId,
    preferredUsername: value.preferredUsername,
    email: value.email,
    workspace: {
      id: value.workspace.id,
      host: value.workspace.host,
    },
    authenticationMode: value.authenticationMode,
    installationAdmin: value.installationAdmin,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isAuthenticationMode(
  value: unknown,
): value is IWorkspaceSession["authenticationMode"] {
  return value === "databricks" || value === "local-test";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") {
      return responseBody.detail;
    }
    if (isRecord(responseBody) && typeof responseBody.title === "string") {
      return responseBody.title;
    }
  } catch {
    // Fall back to a status-only message when the server returned no problem document.
  }

  return `Could not load workspace session (HTTP ${response.status}).`;
}
