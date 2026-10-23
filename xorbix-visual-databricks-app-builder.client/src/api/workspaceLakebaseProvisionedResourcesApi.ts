import {
  WorkspaceLakebaseResourcePage,
  type IWorkspaceLakebaseProvisionedInstance,
  type IWorkspaceLakebaseResourcePage,
  type IWorkspaceLakebaseTable,
  type LakebaseProvisionedMetadataSelection,
} from "../models/WorkspaceLakebaseResources";

const LAKEBASE_PROVISIONED_PATH = "/api/v1/workspace/lakebase/provisioned";

/** Lists Provisioned instances visible to the current Databricks user. */
export async function listWorkspaceLakebaseProvisionedInstances(
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<IWorkspaceLakebaseProvisionedInstance>> {
  return readPage(`${LAKEBASE_PROVISIONED_PATH}/instances`, parseInstance, signal);
}

/** Lists PostgreSQL schemas visible to the current user in one Provisioned database. */
export async function listWorkspaceLakebaseProvisionedSchemas(
  selection: LakebaseProvisionedMetadataSelection,
  signal?: AbortSignal,
): Promise<IWorkspaceLakebaseResourcePage<{ name: string }>> {
  return readPage(withQuery("schemas", selection), parseSchema, signal);
}

/** Lists PostgreSQL tables and columns visible to the current user. */
export async function listWorkspaceLakebaseProvisionedTables(
  selection: LakebaseProvisionedMetadataSelection,
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
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const responseBody: unknown = await response.json();
  if (
    !isRecord(responseBody) ||
    !Array.isArray(responseBody.items) ||
    (responseBody.authenticationMode !== "databricks" && responseBody.authenticationMode !== "local-test")
  ) {
    throw new Error("The workspace returned an invalid Lakebase Provisioned resource response.");
  }
  return new WorkspaceLakebaseResourcePage({
    items: responseBody.items.map(parseItem),
    authenticationMode: responseBody.authenticationMode,
  });
}

function parseInstance(value: unknown): IWorkspaceLakebaseProvisionedInstance {
  if (!isRecord(value) || !isResourceId(value.instanceName) ||
      (value.state !== null && !isSafeLabel(value.state))) {
    throw invalidItem("instance");
  }
  return { instanceName: value.instanceName, state: value.state };
}

function parseSchema(value: unknown): { name: string } {
  if (!isRecord(value) || !isSafeLabel(value.name)) throw invalidItem("schema");
  return { name: value.name };
}

function parseTable(value: unknown): IWorkspaceLakebaseTable {
  if (
    !isRecord(value) ||
    !isSafeLabel(value.name) ||
    (value.tableType !== "BASE TABLE" && value.tableType !== "VIEW") ||
    !Array.isArray(value.columns)
  ) {
    throw invalidItem("table");
  }
  const columns = value.columns.map((column) => {
    if (!isRecord(column) || !isSafeLabel(column.name) || !isSafeLabel(column.type) || typeof column.nullable !== "boolean") {
      throw invalidItem("column");
    }
    return { name: column.name, type: column.type, nullable: column.nullable };
  });
  return { name: value.name, tableType: value.tableType, columns };
}

function withQuery(resource: string, values: Readonly<Record<string, string>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) query.set(key, value);
  return `${LAKEBASE_PROVISIONED_PATH}/${resource}?${query.toString()}`;
}

function isResourceId(value: unknown): value is string {
  return isSafeLabel(value) && !value.includes("/") && !value.includes("\\");
}

function isSafeLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value &&
    !containsControlCharacters(value)
  );
}

function containsControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const characterCode = character.charCodeAt(0);
    return characterCode <= 0x1f || characterCode === 0x7f;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidItem(itemName: string): Error {
  return new Error(`The workspace returned an invalid Lakebase Provisioned ${itemName}.`);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") return responseBody.detail;
    if (isRecord(responseBody) && typeof responseBody.title === "string") return responseBody.title;
  } catch {
    // Use the HTTP status when the response is not a JSON problem document.
  }
  return `Could not load Lakebase Provisioned resources (HTTP ${response.status}).`;
}
