import type {
  CallerIdentity,
  WorkspaceAppSummary,
  WorkspaceAppsPage,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

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
}

interface DatabricksAppListResponse {
  apps?: unknown;
  next_page_token?: unknown;
}

interface DatabricksAppRecord {
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
  };
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
    throw new ApplicationError(
      401,
      "databricks_auth_failed",
      "Databricks sign-in expired",
      "Refresh the app and sign in to Databricks again.",
    );
  }

  if (response.status === 403) {
    throw new ApplicationError(
      403,
      "databricks_apps_access_denied",
      "Apps access is not available",
      "The current user needs the Apps authorization scope and permission to list apps in this workspace.",
    );
  }

  if (!response.ok) {
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

function normalizeWorkspaceHost(workspaceHost: string): string {
  const parsedHost = new URL(workspaceHost);

  if (
    parsedHost.protocol !== "https:" ||
    parsedHost.username.length > 0 ||
    parsedHost.password.length > 0 ||
    parsedHost.pathname !== "/" ||
    parsedHost.search.length > 0 ||
    parsedHost.hash.length > 0
  ) {
    throw new Error("DATABRICKS_HOST must be an HTTPS workspace origin.");
  }

  return parsedHost.origin;
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
    const body: unknown = await response.json();

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

function toWorkspaceAppSummary(
  app: DatabricksAppRecord,
): WorkspaceAppSummary {
  return {
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
