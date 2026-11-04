import {
  WorkspaceLakebaseResourcePage,
  type IWorkspaceLakebaseBranch,
  type IWorkspaceLakebaseDatabase,
  type IWorkspaceLakebaseEndpoint,
  type IWorkspaceLakebaseProject,
  type IWorkspaceLakebaseResourcePage,
  type IWorkspaceLakebaseTable,
  type LakebaseMetadataSelection,
} from "../models/WorkspaceLakebaseResources";

const LAKEBASE_PATH = "/api/v1/workspace/lakebase";

/** Lists Lakebase projects visible to the current Databricks user. */
export async function listWorkspaceLakebaseProjects(
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseProject>> {
  return readPage(`${LAKEBASE_PATH}/projects`, parseProject, signal);
}

/** Lists branches visible to the current user in one Lakebase project. */
export async function listWorkspaceLakebaseBranches(
  projectId: string,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseBranch>> {
  return readPage(withQuery("branches", { projectId }), parseBranch, signal);
}

/** Lists endpoints visible to the current user in one Lakebase branch. */
export async function listWorkspaceLakebaseEndpoints(
  projectId: string,
  branchId: string,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseEndpoint>> {
  return readPage(withQuery("endpoints", { projectId, branchId }), parseEndpoint, signal);
}

/** Lists databases visible to the current user in one Lakebase branch. */
export async function listWorkspaceLakebaseDatabases(
  projectId: string,
  branchId: string,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseDatabase>> {
  return readPage(withQuery("databases", { projectId, branchId }), parseDatabase, signal);
}

/** Lists PostgreSQL schemas visible to the current user through Lakebase OAuth. */
export async function listWorkspaceLakebaseSchemas(
  selection: LakebaseMetadataSelection,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<{ name: string }>> {
  return readPage(withQuery("schemas", selection), parseSchema, signal);
}

/** Lists PostgreSQL tables and columns visible to the current user. */
export async function listWorkspaceLakebaseTables(
  selection: LakebaseMetadataSelection,
  schemaName: string,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseTable>> {
  return readPage(withQuery("tables", { ...selection, schemaName }), parseTable, signal);
}

async function readPage<T>(
  path: string,
  parseItem: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<T>> {
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const responseBody: unknown = await response.json();
  if (
    !isRecord(responseBody) ||
    !Array.isArray(responseBody.items) ||
    (responseBody.authenticationMode !== "databricks" && responseBody.authenticationMode !== "local-test")
  ) {
    throw new Error("The workspace returned an invalid Lakebase resource response.");
  }
  return new WorkspaceLakebaseResourcePage({
    items: responseBody.items.map(parseItem),
    authenticationMode: responseBody.authenticationMode,
  });
}

function parseProject(value: unknown): IWorkspaceLakebaseProject {
  if (
    !isRecord(value) ||
    !isResourceId(value.projectId) ||
    !isSafeLabel(value.displayName)
  ) {
    throw invalidItem("project");
  }
  return { projectId: value.projectId, displayName: value.displayName };
}

function parseBranch(value: unknown): IWorkspaceLakebaseBranch {
  if (
    !isRecord(value) ||
    !isResourceId(value.branchId) ||
    typeof value.isDefault !== "boolean" ||
    !isOneOf(value.state, ["ready", "initializing", "archived", "unknown"])
  ) {
    throw invalidItem("branch");
  }
  return { branchId: value.branchId, isDefault: value.isDefault, state: value.state };
}

function parseEndpoint(value: unknown): IWorkspaceLakebaseEndpoint {
  if (
    !isRecord(value) ||
    !isResourceId(value.endpointId) ||
    !isOneOf(value.endpointType, ["read-write", "read-only"]) ||
    !isOneOf(value.state, ["active", "idle", "initializing", "degraded", "unknown"])
  ) {
    throw invalidItem("endpoint");
  }
  return {
    endpointId: value.endpointId,
    endpointType: value.endpointType,
    state: value.state,
  };
}

function parseDatabase(value: unknown): IWorkspaceLakebaseDatabase {
  if (
    !isRecord(value) ||
    !isResourceId(value.databaseId) ||
    !isResourceId(value.databaseName)
  ) {
    throw invalidItem("database");
  }
  return { databaseId: value.databaseId, databaseName: value.databaseName };
}

function parseSchema(value: unknown): { name: string } {
  if (!isRecord(value) || !isSafeLabel(value.name)) {
    throw invalidItem("schema");
  }
  return { name: value.name };
}

function parseTable(value: unknown): IWorkspaceLakebaseTable {
  if (
    !isRecord(value) ||
    !isSafeLabel(value.name) ||
    !isOneOf(value.tableType, ["BASE TABLE", "VIEW"]) ||
    !Array.isArray(value.columns)
  ) {
    throw invalidItem("table");
  }
  const columns = value.columns.map((column) => {
    if (
      !isRecord(column) ||
      !isSafeLabel(column.name) ||
      !isSafeLabel(column.type) ||
      typeof column.nullable !== "boolean"
    ) {
      throw invalidItem("column");
    }
    return { name: column.name, type: column.type, nullable: column.nullable };
  });
  return { name: value.name, tableType: value.tableType, columns };
}

function withQuery(
  resource: string,
  values: Readonly<Record<string, string>>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    query.set(key, value);
  }
  return `${LAKEBASE_PATH}/${resource}?${query.toString()}`;
}

function isResourceId(value: unknown): value is string {
  return isSafeLabel(value) && !value.includes("/") && !value.includes("\\");
}

function isSafeLabel(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value &&
    // eslint-disable-next-line no-control-regex -- Reject control bytes from workspace metadata before rendering it in selectors.
    !/[\u0000-\u001f\u007f]/.test(value);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.some((allowedValue) => allowedValue === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidItem(itemName: string): Error {
  return new Error(`The workspace returned an invalid Lakebase ${itemName}.`);
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
  return `Could not load Lakebase resources (HTTP ${response.status}).`;
}
