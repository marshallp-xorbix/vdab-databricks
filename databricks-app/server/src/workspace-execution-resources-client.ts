import type {
  CallerIdentity,
  WorkspaceJobResource,
  WorkspaceSqlWarehouseResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

const JOBS_PATH = "/api/2.2/jobs/list";
const SQL_WAREHOUSES_PATH = "/api/2.0/sql/warehouses";
const MAX_PAGES = 50;
const PAGE_SIZE = 100;
const MAX_RESPONSE_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 15_000;

/** Lists Jobs and SQL warehouses using only the acting user's forwarded token. */
export interface WorkspaceExecutionResourcesClient {
  listJobs(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceJobResource[]>;
  listSqlWarehouses(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceSqlWarehouseResource[]>;
}

interface ResourceListResponse {
  jobs?: unknown;
  warehouses?: unknown;
  next_page_token?: unknown;
}

interface JobRecord {
  job_id?: unknown;
  settings?: unknown;
}

interface SqlWarehouseRecord {
  id?: unknown;
  name?: unknown;
  state?: unknown;
}

/** Creates a read-only resource client pinned to the installed workspace. */
export function createWorkspaceExecutionResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceExecutionResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listJobs: (caller, signal) => listJobs(caller, pinnedWorkspaceHost, fetchImplementation, signal),
    listSqlWarehouses: (caller, signal) =>
      listSqlWarehouses(caller, pinnedWorkspaceHost, fetchImplementation, signal),
  };
}

async function listJobs(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceJobResource[]> {
  requireCallerToken(caller);
  const items = new Map<string, WorkspaceJobResource>();
  const pageTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const endpoint = createPageUrl(JOBS_PATH, workspaceHost, pageToken, "limit");
    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the app's Jobs authorization and your permission to view these jobs.",
      signal,
    );
    const body = await readResourceResponse(response, signal);
    const jobs = body.jobs === undefined ? [] : body.jobs;
    if (!Array.isArray(jobs)) throw invalidResourceResponse();
    for (const value of jobs) {
      const item = readJob(value);
      items.set(item.jobId, item);
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) return [...items.values()].sort(compareByName);
    if (pageTokens.has(pageToken)) throw invalidResourceResponse();
    pageTokens.add(pageToken);
  }

  throw listTooLarge();
}

async function listSqlWarehouses(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceSqlWarehouseResource[]> {
  requireCallerToken(caller);
  const items = new Map<string, WorkspaceSqlWarehouseResource>();
  const pageTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const endpoint = createPageUrl(SQL_WAREHOUSES_PATH, workspaceHost, pageToken, "page_size");
    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the sql authorization scope and your permission to use this warehouse.",
      signal,
    );
    const body = await readResourceResponse(response, signal);
    if (!Array.isArray(body.warehouses)) throw invalidResourceResponse();
    for (const value of body.warehouses) {
      const item = readSqlWarehouse(value);
      items.set(item.id, item);
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) return [...items.values()].sort(compareByName);
    if (pageTokens.has(pageToken)) throw invalidResourceResponse();
    pageTokens.add(pageToken);
  }

  throw listTooLarge();
}

function createPageUrl(
  path: string,
  workspaceHost: string,
  pageToken: string | null,
  pageSizeParameter: "limit" | "page_size",
): URL {
  const endpoint = new URL(path, workspaceHost);
  endpoint.searchParams.set(pageSizeParameter, String(PAGE_SIZE));
  if (pageToken) endpoint.searchParams.set("page_token", pageToken);
  return endpoint;
}

async function fetchWorkspaceResource(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  permissionDetail: string,
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  if (!response.ok) {
    throw new ApplicationError(
      502,
      "databricks_request_failed",
      "Databricks request failed",
      "Workspace resources could not be loaded. Try again shortly.",
    );
  }
  return response;
}

async function readResourceResponse(
  response: Response,
  signal?: AbortSignal,
): Promise<ResourceListResponse> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw invalidResourceResponse();
  }
  if (!response.body) throw invalidResourceResponse();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw invalidResourceResponse();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalidResourceResponse();
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const responseText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let value: unknown;
  try {
    value = JSON.parse(responseText);
  } catch {
    throw invalidResourceResponse();
  }
  if (!isRecord(value)) throw invalidResourceResponse();
  return value as ResourceListResponse;
}

function readJob(value: unknown): WorkspaceJobResource {
  if (!isRecord(value) || !Number.isSafeInteger(value.job_id) || (value.job_id as number) < 1) {
    throw invalidResourceResponse();
  }
  const settings = value.settings;
  if (!isRecord(settings) || !isSafeDisplayName(settings.name)) {
    throw invalidResourceResponse();
  }
  return { jobId: String(value.job_id), name: settings.name };
}

function readSqlWarehouse(value: unknown): WorkspaceSqlWarehouseResource {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) || !isSafeDisplayName(value.name)) {
    throw invalidResourceResponse();
  }
  const state = typeof value.state === "string" && ["RUNNING", "STOPPED", "STARTING", "STOPPING"].includes(value.state)
    ? value.state.toLowerCase() as WorkspaceSqlWarehouseResource["state"]
    : "unknown";
  return { id: value.id, name: value.name, state };
}

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) throw invalidResourceResponse();
  return value;
}

function requireCallerToken(caller: CallerIdentity): void {
  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }
}

function isSafeDisplayName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function compareByName(
  left: { name: string },
  right: { name: string },
): number {
  return left.name.localeCompare(right.name);
}

function listTooLarge(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    "The workspace returned more resource pages than this request can safely read.",
  );
}

function invalidResourceResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid Databricks response",
    "Databricks returned an invalid workspace resource response.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWorkspaceHost(workspaceHost: string): string {
  const parsedHost = new URL(workspaceHost);
  if (parsedHost.protocol !== "https:" || parsedHost.username || parsedHost.password ||
      parsedHost.pathname !== "/" || parsedHost.search || parsedHost.hash) {
    throw new Error("DATABRICKS_HOST must be an HTTPS workspace origin.");
  }
  return parsedHost.origin;
}
