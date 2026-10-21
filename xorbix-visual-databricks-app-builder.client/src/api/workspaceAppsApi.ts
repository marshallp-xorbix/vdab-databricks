import {
  WorkspaceAppSummary,
  WorkspaceAppsPage,
  type AuthenticationMode,
  type IWorkspaceAppSummary,
  type IWorkspaceAppsPage,
} from "../models/WorkspaceApp";

const WORKSPACE_APPS_PATH = "/api/v1/workspace/apps";

/** Loads one page of apps visible to the current Databricks workspace user. */
export async function listWorkspaceApps(
  pageToken: string | null,
  signal?: AbortSignal,
): Promise<IWorkspaceAppsPage> {
  const query = new URLSearchParams();
  query.set("pageSize", "100");
  if (pageToken) {
    query.set("pageToken", pageToken);
  }

  const response = await fetch(`${WORKSPACE_APPS_PATH}?${query.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const responseBody: unknown = await response.json();
  return parseWorkspaceAppsPage(responseBody);
}

function parseWorkspaceAppsPage(value: unknown): IWorkspaceAppsPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("The workspace returned an invalid apps response.");
  }

  if (
    value.nextPageToken !== null &&
    typeof value.nextPageToken !== "string"
  ) {
    throw new Error("The workspace returned an invalid apps response.");
  }

  if (!isAuthenticationMode(value.authenticationMode)) {
    throw new Error("The workspace returned an invalid apps response.");
  }

  const items = value.items.map(parseWorkspaceAppSummary);
  return new WorkspaceAppsPage({
    items,
    nextPageToken: value.nextPageToken,
    authenticationMode: value.authenticationMode,
  });
}

function parseWorkspaceAppSummary(value: unknown): IWorkspaceAppSummary {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !isNullableString(value.description) ||
    !isNullableString(value.appState) ||
    !isNullableString(value.computeState)
  ) {
    throw new Error("The workspace returned an invalid app entry.");
  }

  return new WorkspaceAppSummary({
    name: value.name,
    description: value.description,
    appState: value.appState,
    computeState: value.computeState,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isAuthenticationMode(value: unknown): value is AuthenticationMode {
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
    // Use the HTTP status when the response is not a JSON problem document.
  }

  return `Could not load workspace apps (HTTP ${response.status}).`;
}
