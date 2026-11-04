import { ApplicationError } from "./application-error.ts";
import type {
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseDatabaseResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";

const LAKEBASE_HOST_PATTERNS = [
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.(?:dev\.)?cloud\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.gcp\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.azuredatabricks\.net$/,
  /^ep-[a-z0-9-]+\.databricks\.com$/,
];

interface PgMetadataRow {
  schema_name?: unknown;
  table_name?: unknown;
  table_type?: unknown;
  column_name?: unknown;
  data_type?: unknown;
  is_nullable?: unknown;
}

export function readProject(value: unknown): WorkspaceLakebaseProjectResource {
  const record = requireRecord(value, "project");
  const projectId = readResourceId(record.project_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const spec = isRecord(record.spec) ? record.spec : {};
  const displayName = readSafeLabel(status.display_name ?? spec.display_name ?? projectId);
  return { projectId, displayName };
}

export function readBranch(value: unknown): WorkspaceLakebaseBranchResource {
  const record = requireRecord(value, "branch");
  const branchId = readResourceId(record.branch_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const currentState = status.current_state;
  const state = currentState === "READY"
    ? "ready"
    : currentState === "INIT" || currentState === "IMPORTING" || currentState === "RESETTING"
    ? "initializing"
    : currentState === "ARCHIVED"
    ? "archived"
    : "unknown";
  return { branchId, isDefault: status.default === true, state };
}

export function readEndpoint(value: unknown): WorkspaceLakebaseEndpointResource {
  const record = requireRecord(value, "endpoint");
  const endpointId = readResourceId(record.endpoint_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const rawType = status.endpoint_type ?? (isRecord(record.spec) ? record.spec.endpoint_type : null);
  if (rawType !== "ENDPOINT_TYPE_READ_WRITE" && rawType !== "ENDPOINT_TYPE_READ_ONLY") {
    throw invalidLakebaseResponse();
  }
  const currentState = status.current_state;
  const state = currentState === "ACTIVE"
    ? "active"
    : currentState === "IDLE"
    ? "idle"
    : currentState === "INIT"
    ? "initializing"
    : currentState === "DEGRADED"
    ? "degraded"
    : "unknown";
  return {
    endpointId,
    endpointType: rawType === "ENDPOINT_TYPE_READ_WRITE" ? "read-write" : "read-only",
    state,
  };
}

export function readDatabase(value: unknown): WorkspaceLakebaseDatabaseResource {
  const record = requireRecord(value, "database");
  const databaseId = readResourceId(record.database_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const databaseName = readResourceId(status.postgres_database ?? databaseId);
  return { databaseId, databaseName };
}

export function readSchemaRow(value: unknown): string {
  const record = requireRecord(value, "schema metadata");
  return readSafeLabel(record.schema_name);
}

export function groupTableRows(rows: unknown[]): WorkspaceLakebaseTableResource[] {
  const tables = new Map<string, WorkspaceLakebaseTableResource>();
  for (const value of rows) {
    const row = requireRecord(value, "table metadata") as PgMetadataRow;
    if (
      typeof row.table_name !== "string" ||
      (row.table_type !== "BASE TABLE" && row.table_type !== "VIEW") ||
      typeof row.column_name !== "string" ||
      typeof row.data_type !== "string" ||
      (row.is_nullable !== "YES" && row.is_nullable !== "NO")
    ) {
      throw invalidLakebaseResponse();
    }
    let table = tables.get(row.table_name);
    if (!table) {
      table = { name: readSafeLabel(row.table_name), tableType: row.table_type, columns: [] };
      tables.set(table.name, table);
    }
    table.columns.push({
      name: readSafeLabel(row.column_name),
      type: readSafeLabel(row.data_type),
      nullable: row.is_nullable === "YES",
    });
  }
  return [...tables.values()].sort((left, right) => left.name.localeCompare(right.name));
}
export function readResourceId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 255 ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidLakebaseRequest();
  }
  return value;
}

export function readSafeLabel(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidLakebaseResponse();
  }
  return value;
}

export function readLakebaseHost(value: unknown): string {
  if (typeof value !== "string" || value.length > 255) {
    throw invalidLakebaseResponse();
  }
  const host = value.toLowerCase();
  if (!LAKEBASE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    throw invalidLakebaseResponse();
  }
  return host;
}

function readLastResourceId(value: unknown): unknown {
  return typeof value === "string" ? value.split("/").at(-1) : null;
}

export function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw invalidLakebaseResponse();
  }
  return value;
}

export function requireRecord(value: unknown, _description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidLakebaseResponse();
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sortByLabel(
  items: WorkspaceLakebaseProjectResource[],
): WorkspaceLakebaseProjectResource[] {
  return items.sort((left, right) =>
    left.displayName.localeCompare(right.displayName) || left.projectId.localeCompare(right.projectId),
  );
}

export function invalidLakebaseResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_invalid_response",
    "Invalid Lakebase response",
    "Lakebase returned an invalid resource response.",
  );
}

export function invalidLakebaseRequest(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_lakebase_resource_request",
    "Invalid Lakebase resource request",
    "Select a valid Lakebase resource from the current workspace.",
  );
}

export function resourceListTooLarge(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_resource_list_too_large",
    "Lakebase resource list is too large",
    "Lakebase returned more metadata than this request can safely read.",
  );
}

export function metadataUnavailable(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_metadata_unavailable",
    "Lakebase metadata is unavailable",
    "Confirm your Lakebase database role can view this schema and try again.",
  );
}
