import {
  WorkspaceJobsPage,
  WorkspaceSqlWarehousesPage,
} from "../models/WorkspaceExecutionResources";
import type {
  IWorkspaceJob,
  IWorkspaceSqlWarehouse,
} from "../models/WorkspaceExecutionResources";

const WORKSPACE_EXECUTION_RESOURCES_PATH = "/api/v1/workspace/resources";
const VALID_AUTHENTICATION_MODES = ["databricks", "local-test"] as const;
const VALID_WAREHOUSE_STATES = [
  "running",
  "stopped",
  "starting",
  "stopping",
  "unknown",
] as const;

/** Lists visible Jobs in the workspace hosting VDAB. */
export async function listWorkspaceJobs(
  signal?: AbortSignal,
): Promise<WorkspaceJobsPage> {
  const value = await readResourcePage(
    `${WORKSPACE_EXECUTION_RESOURCES_PATH}/jobs`,
    signal,
  );
  if (!Array.isArray(value.items)) {
    throw new Error("The workspace returned an invalid Jobs response.");
  }
  return new WorkspaceJobsPage({
    items: value.items.map(parseWorkspaceJob),
    authenticationMode: parseAuthenticationMode(value.authenticationMode),
  });
}

/** Lists visible SQL warehouses in the workspace hosting VDAB. */
export async function listWorkspaceSqlWarehouses(
  signal?: AbortSignal,
): Promise<WorkspaceSqlWarehousesPage> {
  const value = await readResourcePage(
    `${WORKSPACE_EXECUTION_RESOURCES_PATH}/sql-warehouses`,
    signal,
  );
  if (!Array.isArray(value.items)) {
    throw new Error("The workspace returned an invalid SQL warehouse response.");
  }
  return new WorkspaceSqlWarehousesPage({
    items: value.items.map(parseWorkspaceSqlWarehouse),
    authenticationMode: parseAuthenticationMode(value.authenticationMode),
  });
}

async function readResourcePage(
  path: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const value: unknown = await response.json();
  if (!isRecord(value)) {
    throw new Error("The workspace returned an invalid resource response.");
  }
  return value;
}

function parseWorkspaceJob(value: unknown): IWorkspaceJob {
  if (
    !isRecord(value) ||
    typeof value.jobId !== "string" ||
    !/^\d{1,20}$/.test(value.jobId) ||
    !isSafeName(value.name)
  ) {
    throw new Error("The workspace returned an invalid Job.");
  }
  return { jobId: value.jobId, name: value.name };
}

function parseWorkspaceSqlWarehouse(value: unknown): IWorkspaceSqlWarehouse {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) ||
    !isSafeName(value.name) ||
    typeof value.state !== "string" ||
    !(VALID_WAREHOUSE_STATES as readonly string[]).includes(value.state)
  ) {
    throw new Error("The workspace returned an invalid SQL warehouse.");
  }
  return {
    id: value.id,
    name: value.name,
    state: value.state as IWorkspaceSqlWarehouse["state"],
  };
}

function parseAuthenticationMode(
  value: unknown,
): "databricks" | "local-test" {
  if (
    typeof value !== "string" ||
    !(VALID_AUTHENTICATION_MODES as readonly string[]).includes(value)
  ) {
    throw new Error("The workspace returned an invalid authentication mode.");
  }
  return value as "databricks" | "local-test";
}

function isSafeName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 &&
    value.trim() === value &&
    // eslint-disable-next-line no-control-regex -- Reject control bytes before treating a resource name as a URL path segment.
    !/[\u0000-\u001f\u007f]/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    // Use status when the response is not a Problem Details document.
  }
  return `Could not load workspace resources (HTTP ${response.status}).`;
}
