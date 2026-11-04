import type {
  CallerIdentity,
  WorkspaceJobResource,
  WorkspaceSqlWarehouseResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  fetchWorkspaceResource,
  invalidWorkspaceResourceResponse,
  isRecord,
  normalizeWorkspaceHost,
  readWorkspaceResourceResponse,
} from "./workspace-resource-api.ts";

const JOBS_PATH = "/api/2.2/jobs/list";
const SQL_WAREHOUSES_PATH = "/api/2.0/sql/warehouses";
const MAX_PAGES = 50;
const PAGE_SIZE = 100;

/** Lists Jobs and SQL warehouses using only the acting user's forwarded token. */
export interface WorkspaceExecutionResourcesClient {
  listJobs(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceJobResource[]>;
  listSqlWarehouses(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceSqlWarehouseResource[]>;
}

/** Creates a read-only resource client pinned to the installed workspace. */
export function createWorkspaceExecutionResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceExecutionResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listJobs: (caller, signal) =>
      listJobs(caller, pinnedWorkspaceHost, fetchImplementation, signal),
    listSqlWarehouses: (caller, signal) =>
      listSqlWarehouses(
        caller,
        pinnedWorkspaceHost,
        fetchImplementation,
        signal,
      ),
  };
}

async function listJobs(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceJobResource[]> {
  const items = new Map<string, WorkspaceJobResource>();
  const pageTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const endpoint = createPageUrl(
      JOBS_PATH,
      workspaceHost,
      pageToken,
      "limit",
    );
    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the app's Jobs authorization and your permission to view these jobs.",
      signal,
    );
    const body = await readWorkspaceResourceResponse(response, signal);
    const jobs = body.jobs === undefined ? [] : body.jobs;
    if (!Array.isArray(jobs)) throw invalidWorkspaceResourceResponse();
    for (const value of jobs) {
      const item = readJob(value);
      items.set(item.jobId, item);
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) return [...items.values()].sort(compareByName);
    if (pageTokens.has(pageToken)) throw invalidWorkspaceResourceResponse();
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
  const items = new Map<string, WorkspaceSqlWarehouseResource>();
  const pageTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const endpoint = createPageUrl(
      SQL_WAREHOUSES_PATH,
      workspaceHost,
      pageToken,
      "page_size",
    );
    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the sql authorization scope and your permission to use this warehouse.",
      signal,
    );
    const body = await readWorkspaceResourceResponse(response, signal);
    if (!Array.isArray(body.warehouses)) {
      throw invalidWorkspaceResourceResponse();
    }
    for (const value of body.warehouses) {
      const item = readSqlWarehouse(value);
      items.set(item.id, item);
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) return [...items.values()].sort(compareByName);
    if (pageTokens.has(pageToken)) throw invalidWorkspaceResourceResponse();
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

function readJob(value: unknown): WorkspaceJobResource {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.job_id) ||
    (value.job_id as number) < 1
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  const settings = value.settings;
  if (!isRecord(settings) || !isSafeDisplayName(settings.name)) {
    throw invalidWorkspaceResourceResponse();
  }
  return { jobId: String(value.job_id), name: settings.name };
}

function readSqlWarehouse(value: unknown): WorkspaceSqlWarehouseResource {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) ||
    !isSafeDisplayName(value.name)
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  const state =
    typeof value.state === "string" &&
    ["RUNNING", "STOPPED", "STARTING", "STOPPING"].includes(value.state)
      ? (value.state.toLowerCase() as WorkspaceSqlWarehouseResource["state"])
      : "unknown";
  return { id: value.id, name: value.name, state };
}

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw invalidWorkspaceResourceResponse();
  }
  return value;
}

function isSafeDisplayName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
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
