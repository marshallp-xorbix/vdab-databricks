import type { CallerIdentity } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  discardHttpResponseBody,
  readBoundedJsonResponse,
} from "./bounded-json-response.ts";

export const MAX_WORKSPACE_RESOURCE_RESPONSE_BYTES = 4_000_000;
const WORKSPACE_RESOURCE_REQUEST_TIMEOUT_MS = 15_000;

export { normalizeWorkspaceHost } from "./workspace-host.ts";

/** Fetches one resource page with the caller token and sanitized error mapping. */
export async function fetchWorkspaceResource(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  permissionDetail: string = "Confirm the app has the required user authorization scope and that you can access this Unity Catalog resource.",
  signal?: AbortSignal,
): Promise<Response> {
  return callWorkspaceResource(
    endpoint,
    caller,
    fetchImplementation,
    "GET",
    undefined,
    permissionDetail,
    signal,
  );
}

/** Posts to a workspace resource endpoint with the caller token. */
export async function postWorkspaceResource(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  body: Record<string, unknown>,
  permissionDetail: string,
  signal?: AbortSignal,
  allowedStatusCodes: number[] = [],
): Promise<Response> {
  return callWorkspaceResource(
    endpoint,
    caller,
    fetchImplementation,
    "POST",
    body,
    permissionDetail,
    signal,
    allowedStatusCodes,
  );
}

async function callWorkspaceResource(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  method: "GET" | "POST",
  body: Record<string, unknown> | undefined,
  permissionDetail: string,
  signal?: AbortSignal,
  allowedStatusCodes: number[] = [],
): Promise<Response> {
  requireWorkspaceCallerToken(caller);
  let response: Response;

  try {
    response = await fetchImplementation(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: signal
        ? AbortSignal.any([
            signal,
            AbortSignal.timeout(WORKSPACE_RESOURCE_REQUEST_TIMEOUT_MS),
          ])
        : AbortSignal.timeout(WORKSPACE_RESOURCE_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApplicationError(
      502,
      "databricks_unavailable",
      "Databricks is unavailable",
      "Workspace resources could not be loaded. Try again shortly.",
    );
  }

  if (response.ok || allowedStatusCodes.includes(response.status)) {
    return response;
  }
  await discardHttpResponseBody(response);
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
      "databricks_resource_access_denied",
      "Workspace resource access is not available",
      permissionDetail,
    );
  }
  throw new ApplicationError(
    502,
    "databricks_request_failed",
    "Databricks request failed",
    "Workspace resources could not be loaded. Try again shortly.",
  );
}

/** Reads and validates a bounded JSON object from a workspace API response. */
export async function readWorkspaceResourceResponse(
  response: Response,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await readBoundedJsonResponse(
      response,
      MAX_WORKSPACE_RESOURCE_RESPONSE_BYTES,
      signal,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalidWorkspaceResourceResponse();
  }
  if (!isRecord(body)) throw invalidWorkspaceResourceResponse();
  return body;
}

/** Checks that an unknown API value is a non-array record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Creates the standard sanitized error for malformed workspace resource data. */
export function invalidWorkspaceResourceResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid Databricks response",
    "Databricks returned an invalid workspace resource response.",
  );
}

function requireWorkspaceCallerToken(caller: CallerIdentity): void {
  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }
}
