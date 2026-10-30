import type {
  CallerIdentity,
  WorkspaceAppSummary,
  WorkspaceAppsPage,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { normalizeWorkspaceHost } from "./workspace-host.ts";
import { readWorkspaceAppUrl } from "./workspace-app-url.ts";
import {
  MAX_WORKSPACE_JSON_RESPONSE_BYTES,
  discardHttpResponseBody,
  readBoundedJsonResponse,
} from "./bounded-json-response.ts";

const WORKSPACE_APPS_PATH = "/api/2.0/apps";
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_TOKEN_LENGTH = 2048;

/** Parameters accepted by the same-workspace Apps list operation. */
export interface WorkspaceAppsQuery {
  pageSize: number;
  pageToken: string | null;
}

/** Performs read-only Apps discovery using the acting user's forwarded token. */
export interface WorkspaceAppsClient {
  listApps(
    caller: CallerIdentity,
    query: WorkspaceAppsQuery,
  ): Promise<WorkspaceAppsPage>;
  getApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary>;
  startApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary>;
  stopApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary>;
}

interface DatabricksAppListResponse {
  apps?: unknown;
  next_page_token?: unknown;
}

interface DatabricksAppRecord {
  url?: unknown;
  name?: unknown;
  description?: unknown;
  app_status?: {
    state?: unknown;
  };
  compute_status?: {
    state?: unknown;
  };
}

/** Creates a typed client pinned to the app's configured workspace host. */
export function createWorkspaceAppsClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceAppsClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);

  return {
    listApps: async (caller, query) =>
      listWorkspaceApps(
        caller,
        query,
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
    getApp: async (caller, appName) =>
      requestWorkspaceApp(caller, appName, "GET", workspaceHost, fetchImplementation),
    startApp: async (caller, appName) =>
      requestWorkspaceApp(caller, appName, "POST", workspaceHost, fetchImplementation, "start"),
    stopApp: async (caller, appName) =>
      requestWorkspaceApp(caller, appName, "POST", workspaceHost, fetchImplementation, "stop"),
  };
}

async function requestWorkspaceApp(
  caller: CallerIdentity,
  appName: string,
  method: "GET" | "POST",
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  action?: "start" | "stop",
): Promise<WorkspaceAppSummary> {
  validateWorkspaceAppName(appName);
  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }

  const suffix = action ? `/${action}` : "";
  const endpoint = new URL(
    `${WORKSPACE_APPS_PATH}/${encodeURIComponent(appName)}${suffix}`,
    workspaceHost,
  );
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApplicationError(
      502,
      "databricks_unavailable",
      "Databricks is unavailable",
      "The workspace App operation could not be completed. Try again shortly.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    await discardHttpResponseBody(response);
    throw new ApplicationError(
      response.status,
      response.status === 401 ? "databricks_auth_failed" : "databricks_apps_access_denied",
      response.status === 401 ? "Databricks sign-in expired" : "Apps access is not available",
      response.status === 401
        ? "Refresh the app and sign in to Databricks again."
        : "The current user needs Apps authorization and permission to manage this workspace App.",
    );
  }
  if (!response.ok) {
    await discardHttpResponseBody(response);
    throw new ApplicationError(
      502,
      "databricks_request_failed",
      "Databricks request failed",
      "The workspace App operation could not be completed. Try again shortly.",
    );
  }

  try {
    const value = await readBoundedJsonResponse(response, MAX_WORKSPACE_JSON_RESPONSE_BYTES);
    if (!isDatabricksAppRecord(value) || value.name !== appName || !isWorkspaceAppState(value)) {
      throw new Error("Invalid App response.");
    }
    return toWorkspaceAppSummary(value);
  } catch {
    throw new ApplicationError(
      502,
      "databricks_invalid_response",
      "Invalid Databricks response",
      "Databricks returned an invalid App response.",
    );
  }
}

function validateWorkspaceAppName(appName: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(appName)) {
    throw new ApplicationError(
      400,
      "invalid_app_name",
      "Invalid App name",
      "The workspace App name is invalid.",
    );
  }
}

function isWorkspaceAppState(value: DatabricksAppRecord): boolean {
  return (
    typeof value.app_status?.state === "string" &&
    typeof value.compute_status?.state === "string"
  );
}

async function listWorkspaceApps(
  caller: CallerIdentity,
  query: WorkspaceAppsQuery,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceAppsPage> {
  validateWorkspaceAppsQuery(query);

  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }

  const endpoint = new URL(WORKSPACE_APPS_PATH, workspaceHost);
  endpoint.searchParams.set("page_size", String(query.pageSize));

  if (query.pageToken) {
    endpoint.searchParams.set("page_token", query.pageToken);
  }

  let response: Response;

  try {
    response = await fetchImplementation(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApplicationError(
      502,
      "databricks_unavailable",
      "Databricks is unavailable",
      "The workspace app list could not be loaded. Try again shortly.",
    );
  }

  if (response.status === 401) {
    await discardHttpResponseBody(response);
    throw new ApplicationError(
      401,
      "databricks_auth_failed",
      "Databricks sign-in expired",
      "Refresh the app and sign in to Databricks again.",
    );
  }

  if (response.status === 403) {
    await discardHttpResponseBody(response);
    throw new ApplicationError(
      403,
      "databricks_apps_access_denied",
      "Apps access is not available",
      "The current user needs the Apps authorization scope and permission to list apps in this workspace.",
    );
  }

  if (!response.ok) {
    await discardHttpResponseBody(response);
    throw new ApplicationError(
      502,
      "databricks_request_failed",
      "Databricks request failed",
      "The workspace app list could not be loaded. Try again shortly.",
    );
  }

  const responseBody = await readListResponse(response);
  const appRecords = responseBody.apps;
  const validAppRecords = Array.isArray(appRecords)
    ? appRecords.filter(isDatabricksAppRecord)
    : [];

  if (
    !Array.isArray(appRecords) ||
    validAppRecords.length !== appRecords.length ||
    (responseBody.next_page_token !== undefined &&
      typeof responseBody.next_page_token !== "string")
  ) {
    throw new ApplicationError(
      502,
      "databricks_invalid_response",
      "Invalid Databricks response",
      "Databricks returned an invalid app list response.",
    );
  }

  return {
    items: validAppRecords.map(toWorkspaceAppSummary),
    nextPageToken:
      typeof responseBody.next_page_token === "string" &&
      responseBody.next_page_token.length > 0
        ? responseBody.next_page_token
        : null,
    authenticationMode: "databricks",
  };
}

function validateWorkspaceAppsQuery(query: WorkspaceAppsQuery): void {
  if (
    !Number.isInteger(query.pageSize) ||
    query.pageSize < 1 ||
    query.pageSize > MAX_PAGE_SIZE
  ) {
    throw new ApplicationError(
      400,
      "invalid_page_size",
      "Invalid page size",
      `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }

  if (query.pageToken && query.pageToken.length > MAX_PAGE_TOKEN_LENGTH) {
    throw new ApplicationError(
      400,
      "invalid_page_token",
      "Invalid page token",
      "The page token is too long.",
    );
  }
}

async function readListResponse(
  response: Response,
): Promise<DatabricksAppListResponse> {
  try {
    const body = await readBoundedJsonResponse(
      response,
      MAX_WORKSPACE_JSON_RESPONSE_BYTES,
    );

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("Invalid response body.");
    }

    return body as DatabricksAppListResponse;
  } catch {
    throw new ApplicationError(
      502,
      "databricks_invalid_response",
      "Invalid Databricks response",
      "Databricks returned an invalid app list response.",
    );
  }
}

function isDatabricksAppRecord(value: unknown): value is DatabricksAppRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as DatabricksAppRecord).name === "string"
  );
}

function toWorkspaceAppSummary(app: DatabricksAppRecord): WorkspaceAppSummary {
  return {
    ...(app.url === undefined ? {} : { url: readWorkspaceAppUrl(app.name as string, app.url) }),
    name: app.name as string,
    description: typeof app.description === "string" ? app.description : null,
    appState:
      typeof app.app_status?.state === "string" ? app.app_status.state : null,
    computeState:
      typeof app.compute_status?.state === "string"
        ? app.compute_status.state
        : null,
  };
}
