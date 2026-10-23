import type {
  CallerIdentity,
  WorkspaceLakebaseProvisionedInstanceResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { createProvisionedPostgresConnection } from "./workspace-lakebase-provisioned-postgres-client.ts";
import type {
  ProvisionedPostgresConnection,
  ProvisionedPostgresConnectionFactory,
  ProvisionedPostgresConnectionOptions,
} from "./workspace-lakebase-provisioned-postgres-client.ts";

const DATABASE_API_PATH = "/api/2.0/database";
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_INSTANCES = 5_000;
const MAX_METADATA_ROWS = 5_000;
const MAX_INSTANCE_PAGES = 50;
const INSTANCE_PAGE_SIZE = 100;
const MAX_PAGE_TOKEN_LENGTH = 2_048;
const REQUEST_TIMEOUT_MS = 15_000;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_$-]{1,63}$/;
const INSTANCE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const LAKEBASE_HOST_PATTERNS = [
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.(?:dev\.)?databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.cloud\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.gcp\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.azuredatabricks\.net$/,
];
const LIST_SCHEMAS_SQL = `
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
  AND schema_name NOT LIKE 'pg_toast%'
ORDER BY schema_name
LIMIT $1`;
const LIST_TABLES_SQL = `
SELECT tables.table_name, tables.table_type, columns.column_name,
       columns.data_type, columns.is_nullable, columns.ordinal_position
FROM information_schema.tables AS tables
JOIN information_schema.columns AS columns
  ON columns.table_catalog = tables.table_catalog
 AND columns.table_schema = tables.table_schema
 AND columns.table_name = tables.table_name
WHERE tables.table_schema = $1
  AND tables.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY tables.table_name, columns.ordinal_position
LIMIT $2`;

export type {
  ProvisionedPostgresConnection,
  ProvisionedPostgresConnectionOptions,
  ProvisionedPostgresConnectionFactory,
} from "./workspace-lakebase-provisioned-postgres-client.ts";
/** Lists and describes legacy Provisioned instances in the installed workspace. */
export interface WorkspaceLakebaseProvisionedResourcesClient {
  listInstances(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseProvisionedInstanceResource[]>;
  listSchemas(
    caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
    signal?: AbortSignal,
  ): Promise<string[]>;
  listTables(
    caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
    schemaName: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseTableResource[]>;
}

/** Creates a caller-authorized client pinned to the configured Databricks workspace. */
export function createWorkspaceLakebaseProvisionedResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
  connectionFactory: ProvisionedPostgresConnectionFactory = createProvisionedPostgresConnection,
): WorkspaceLakebaseProvisionedResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listInstances: (caller, signal) => listInstances(caller, pinnedWorkspaceHost, fetchImplementation, signal),
    listSchemas: (caller, instanceName, databaseName, signal) => listSchemas(
      caller,
      instanceName,
      databaseName,
      pinnedWorkspaceHost,
      fetchImplementation,
      connectionFactory,
      signal,
    ),
    listTables: (caller, instanceName, databaseName, schemaName, signal) => listTables(
      caller,
      instanceName,
      databaseName,
      schemaName,
      pinnedWorkspaceHost,
      fetchImplementation,
      connectionFactory,
      signal,
    ),
  };
}

async function listInstances(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseProvisionedInstanceResource[]> {
  const instances: WorkspaceLakebaseProvisionedInstanceResource[] = [];
  const pageTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let pageCount = 0; pageCount < MAX_INSTANCE_PAGES; pageCount += 1) {
    const query = new URLSearchParams({ page_size: String(INSTANCE_PAGE_SIZE) });
    if (pageToken) query.set("page_token", pageToken);
    const body = await requestJson(
      caller,
      "GET",
      `${DATABASE_API_PATH}/instances?${query.toString()}`,
      workspaceHost,
      fetchImplementation,
      undefined,
      signal,
    );
    const response = requireRecord(body);
    if (!Array.isArray(response.database_instances)) throw invalidResponse();
    const page = response.database_instances.map(readInstanceSummary);
    if (instances.length + page.length > MAX_INSTANCES) throw invalidResponse();
    instances.push(...page.map(({ instanceName, state }) => ({ instanceName, state })));

    const nextPageToken = readPageToken(response.next_page_token);
    if (!nextPageToken) {
      return instances.sort((left, right) => left.instanceName.localeCompare(right.instanceName));
    }
    if (pageTokens.has(nextPageToken)) throw invalidResponse();
    pageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  throw invalidResponse();
}

async function listSchemas(
  caller: CallerIdentity,
  instanceName: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: ProvisionedPostgresConnectionFactory,
  signal?: AbortSignal,
): Promise<string[]> {
  const connection = await createUserConnection(
    caller,
    instanceName,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
    signal,
  );
  try {
    const rows = await connection.query(LIST_SCHEMAS_SQL, [MAX_METADATA_ROWS + 1]);
    if (rows.length > MAX_METADATA_ROWS) throw invalidResponse();
    return rows.map((row) => readString(requireRecord(row).schema_name));
  } catch (error) {
    throwMetadataFailure(error, signal);
  } finally {
    await connection.close();
  }
}

async function listTables(
  caller: CallerIdentity,
  instanceName: string,
  databaseName: string,
  schemaName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: ProvisionedPostgresConnectionFactory,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseTableResource[]> {
  const safeSchemaName = readResourceName(schemaName);
  const connection = await createUserConnection(
    caller,
    instanceName,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
    signal,
  );
  try {
    const rows = await connection.query(LIST_TABLES_SQL, [safeSchemaName, MAX_METADATA_ROWS + 1]);
    return groupTableRows(rows);
  } catch (error) {
    throwMetadataFailure(error, signal);
  } finally {
    await connection.close();
  }
}

async function createUserConnection(
  caller: CallerIdentity,
  instanceName: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: ProvisionedPostgresConnectionFactory,
  signal?: AbortSignal,
): Promise<ProvisionedPostgresConnection> {
  requireCaller(caller);
  const user = readEmail(caller.email);
  const safeInstanceName = readInstanceName(instanceName);
  const safeDatabaseName = readDatabaseName(databaseName);
  const instanceBody = await requestJson(
    caller,
    "GET",
    `${DATABASE_API_PATH}/instances/${encodeURIComponent(safeInstanceName)}`,
    workspaceHost,
    fetchImplementation,
    undefined,
    signal,
  );
  const instance = readInstance(instanceBody);
  const credentialBody = await requestJson(
    caller,
    "POST",
    `${DATABASE_API_PATH}/credentials`,
    workspaceHost,
    fetchImplementation,
    { instance_names: [safeInstanceName] },
    signal,
  );
  const credential = requireRecord(credentialBody);
  const password = readCredential(credential.token);
  return connectionFactory({
    host: instance.host,
    user,
    database: safeDatabaseName,
    password,
  });
}

async function requestJson(
  caller: CallerIdentity,
  method: "GET" | "POST",
  path: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  requireCaller(caller);
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let response: Response;
  const responseSignal = requestSignal;
  try {
    response = await fetchImplementation(new URL(path, workspaceHost), {
      method,
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: requestSignal,
      redirect: "error",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw workspaceUnavailable();
  }
  if (!response.ok) {
    if (response.status === 401) throw callerAuthenticationError();
    if (response.status === 403) throw callerPermissionError();
    throw workspaceRejected();
  }
  let responseText: string;
  try {
    responseText = await readBoundedResponseText(response, responseSignal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw workspaceUnavailable();
  }
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw invalidResponse();
  }
}

async function readBoundedResponseText(response: Response, signal?: AbortSignal): Promise<string> {
  if (!response.body) throw invalidResponse();
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
        throw invalidResponse();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalidResponse();
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidResponse();
  }
}

function readInstance(value: unknown): WorkspaceLakebaseProvisionedInstanceResource & { host: string } {
  const record = requireRecord(value);
  const instanceName = readInstanceName(record.name);
  const host = readLakebaseHost(record.read_write_dns);
  const state = typeof record.state === "string" ? readSafeLabel(record.state) : null;
  return { instanceName, state, host };
}

function readInstanceSummary(value: unknown): WorkspaceLakebaseProvisionedInstanceResource {
  const record = requireRecord(value);
  const instanceName = readInstanceName(record.name);
  const state = typeof record.state === "string" ? readSafeLabel(record.state) : null;
  return { instanceName, state };
}

function groupTableRows(rows: unknown[]): WorkspaceLakebaseTableResource[] {
  if (rows.length > MAX_METADATA_ROWS) throw invalidResponse();
  const tables = new Map<string, WorkspaceLakebaseTableResource>();
  for (const value of rows) {
    const row = requireRecord(value);
    const tableName = readSafeLabel(row.table_name);
    const tableType = row.table_type;
    const columnName = readSafeLabel(row.column_name);
    const dataType = readSafeLabel(row.data_type);
    if (
      (tableType !== "BASE TABLE" && tableType !== "VIEW") ||
      (row.is_nullable !== "YES" && row.is_nullable !== "NO")
    ) throw invalidResponse();
    let table = tables.get(tableName);
    if (!table) {
      table = { name: tableName, tableType, columns: [] };
      tables.set(tableName, table);
    }
    table.columns.push({ name: columnName, type: dataType, nullable: row.is_nullable === "YES" });
  }
  return [...tables.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeWorkspaceHost(value: string): string {
  try {
    const host = new URL(value);
    if (host.protocol !== "https:" || host.username || host.password || host.pathname !== "/" || host.search || host.hash) {
      throw new Error();
    }
    return host.origin;
  } catch {
    throw new ApplicationError(500, "workspace_configuration_invalid", "Workspace configuration unavailable", "The installed workspace could not be configured safely.");
  }
}

function requireCaller(caller: CallerIdentity): void {
  if (!caller.databricksAccessToken) throw callerAuthenticationError();
}

function readInstanceName(value: unknown): string {
  if (typeof value !== "string" || !INSTANCE_NAME_PATTERN.test(value)) throw invalidRequest();
  return value;
}

function readDatabaseName(value: unknown): string {
  if (typeof value !== "string" || !DATABASE_NAME_PATTERN.test(value)) throw invalidRequest();
  return value;
}

function readResourceName(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 255 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw invalidRequest();
  }
  return value;
}

function readEmail(value: unknown): string {
  if (typeof value !== "string" || value.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(value)) {
    throw new ApplicationError(401, "databricks_user_identity_required", "Sign in required", "Databricks did not provide a user identity for Lakebase access.");
  }
  return value;
}

function readCredential(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 10_000) throw invalidResponse();
  return value;
}

function readPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_PAGE_TOKEN_LENGTH) throw invalidResponse();
  return value;
}

function readLakebaseHost(value: unknown): string {
  if (typeof value !== "string" || value.length > 255) throw invalidResponse();
  const host = value.toLowerCase();
  if (!LAKEBASE_HOST_PATTERNS.some((pattern) => pattern.test(host))) throw invalidResponse();
  return host;
}

function readString(value: unknown): string {
  return readSafeLabel(value);
}

function readSafeLabel(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw invalidResponse();
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}

function invalidRequest(): ApplicationError {
  return new ApplicationError(400, "invalid_lakebase_provisioned_request", "Invalid Lakebase Provisioned resource request", "Select a valid instance, database, schema, and table from the installed workspace.");
}

function invalidResponse(): ApplicationError {
  return new ApplicationError(502, "invalid_lakebase_provisioned_response", "Lakebase resource response unavailable", "Databricks returned invalid Lakebase Provisioned resource metadata.");
}

function callerAuthenticationError(): ApplicationError {
  return new ApplicationError(401, "databricks_session_required", "Sign in required", "Open this app through Databricks and sign in to continue.");
}

function callerPermissionError(): ApplicationError {
  return new ApplicationError(403, "workspace_resource_access_denied", "Workspace resource access denied", "Your current Databricks user does not have the scope or permission required for this Lakebase resource.");
}

function workspaceRejected(): ApplicationError {
  return new ApplicationError(502, "workspace_resource_request_failed", "Workspace request failed", "Databricks rejected the Lakebase Provisioned resource request.");
}

function workspaceUnavailable(): ApplicationError {
  return new ApplicationError(502, "workspace_unavailable", "Workspace unavailable", "The Databricks workspace could not be reached.");
}

function metadataAccessError(): ApplicationError {
  return new ApplicationError(403, "lakebase_metadata_access_denied", "Lakebase metadata unavailable", "The current Databricks user could not read PostgreSQL metadata in this database.");
}

function throwMetadataFailure(error: unknown, signal?: AbortSignal): never {
  if (signal?.aborted) throw signal.reason;
  if (error instanceof ApplicationError && error.code === "invalid_lakebase_provisioned_response") {
    throw error;
  }
  throw metadataAccessError();
}
