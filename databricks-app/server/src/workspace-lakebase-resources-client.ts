import { Pool } from "pg";
import type { PoolConfig } from "pg";
import type {
  CallerIdentity,
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseDatabaseResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

const POSTGRES_API_PATH = "/api/2.0/postgres";
const PROJECTS_PATH = `${POSTGRES_API_PATH}/projects`;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_METADATA_ROWS = 5_000;
const REQUEST_TIMEOUT_MS = 15_000;
const PG_TIMEOUT_MS = 10_000;
const POSTGRES_PORT = 5432;
const OAUTH_TOKEN_TTL = "300s";
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
const LAKEBASE_HOST_PATTERNS = [
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.(?:dev\.)?cloud\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.gcp\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.databricks\.com$/,
  /^ep-[a-z0-9-]+\.database\.[a-z0-9-]+\.azuredatabricks\.net$/,
  /^ep-[a-z0-9-]+\.databricks\.com$/,
];

export interface LakebasePostgresConnection {
  query(statement: string, parameters: readonly (string | number)[]): Promise<unknown[]>;
  close(): Promise<void>;
}

export interface LakebasePostgresConnectionOptions {
  host: string;
  user: string;
  database: string;
  password: string;
}

export type LakebasePostgresConnectionFactory = (
  options: LakebasePostgresConnectionOptions,
) => LakebasePostgresConnection;

/** Lists and describes Lakebase resources using the acting user's identity. */
export interface WorkspaceLakebaseResourcesClient {
  listProjects(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceLakebaseProjectResource[]>;
  listBranches(
    caller: CallerIdentity,
    projectId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseBranchResource[]>;
  listEndpoints(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseEndpointResource[]>;
  listDatabases(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
  ): Promise<WorkspaceLakebaseDatabaseResource[]>;
  listSchemas(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
  ): Promise<string[]>;
  listTables(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
    schemaName: string,
  ): Promise<WorkspaceLakebaseTableResource[]>;
}

interface LakebaseApiResponse {
  projects?: unknown;
  branches?: unknown;
  endpoints?: unknown;
  databases?: unknown;
  next_page_token?: unknown;
  status?: unknown;
  token?: unknown;
}

interface PgMetadataRow {
  schema_name?: unknown;
  table_name?: unknown;
  table_type?: unknown;
  column_name?: unknown;
  data_type?: unknown;
  is_nullable?: unknown;
}

/** Creates a client pinned to the configured workspace and Lakebase host family. */
export function createWorkspaceLakebaseResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
  connectionFactory: LakebasePostgresConnectionFactory = createPostgresConnection,
): WorkspaceLakebaseResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);

  return {
    listProjects: async (caller, signal) => listProjects(caller, pinnedWorkspaceHost, fetchImplementation, signal),
    listBranches: async (caller, projectId, signal) => listBranches(
      caller,
      projectId,
      pinnedWorkspaceHost,
      fetchImplementation,
      signal,
    ),
    listEndpoints: async (caller, projectId, branchId, signal) => listEndpoints(
      caller,
      projectId,
      branchId,
      pinnedWorkspaceHost,
      fetchImplementation,
      signal,
    ),
    listDatabases: async (caller, projectId, branchId) => listDatabases(
      caller,
      projectId,
      branchId,
      pinnedWorkspaceHost,
      fetchImplementation,
    ),
    listSchemas: async (caller, projectId, branchId, endpointId, databaseName) =>
      listSchemas(
        caller,
        projectId,
        branchId,
        endpointId,
        databaseName,
        pinnedWorkspaceHost,
        fetchImplementation,
        connectionFactory,
      ),
    listTables: async (
      caller,
      projectId,
      branchId,
      endpointId,
      databaseName,
      schemaName,
    ) => listTables(
      caller,
      projectId,
      branchId,
      endpointId,
      databaseName,
      schemaName,
      pinnedWorkspaceHost,
      fetchImplementation,
      connectionFactory,
    ),
  };
}

async function listProjects(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseProjectResource[]> {
  const records = await listApiRecords(
    caller,
    PROJECTS_PATH,
    "projects",
    workspaceHost,
    fetchImplementation,
    signal,
  );
  return sortByLabel(records.map(readProject));
}

async function listBranches(
  caller: CallerIdentity,
  projectId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseBranchResource[]> {
  const path = `${PROJECTS_PATH}/${encodeResourceId(projectId)}/branches`;
  const records = await listApiRecords(caller, path, "branches", workspaceHost, fetchImplementation, signal);
  return records.map(readBranch).sort((left, right) => left.branchId.localeCompare(right.branchId));
}

async function listEndpoints(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseEndpointResource[]> {
  const path = `${branchPath(projectId, branchId)}/endpoints`;
  const records = await listApiRecords(caller, path, "endpoints", workspaceHost, fetchImplementation, signal);
  return records.map(readEndpoint).sort((left, right) => left.endpointId.localeCompare(right.endpointId));
}

async function listDatabases(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceLakebaseDatabaseResource[]> {
  const path = `${branchPath(projectId, branchId)}/databases`;
  const records = await listApiRecords(caller, path, "databases", workspaceHost, fetchImplementation);
  return records.map(readDatabase).sort((left, right) => left.databaseName.localeCompare(right.databaseName));
}

async function listSchemas(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<string[]> {
  const connection = await createUserConnection(
    caller,
    projectId,
    branchId,
    endpointId,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
  );

  try {
    const rows = await connection.query(LIST_SCHEMAS_SQL, [MAX_METADATA_ROWS + 1]);
    if (rows.length > MAX_METADATA_ROWS) {
      throw resourceListTooLarge();
    }
    const schemas = rows.map(readSchemaRow);
    return schemas.sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw metadataUnavailable();
  } finally {
    await connection.close();
  }
}

async function listTables(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  schemaName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<WorkspaceLakebaseTableResource[]> {
  const connection = await createUserConnection(
    caller,
    projectId,
    branchId,
    endpointId,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
  );

  try {
    const rows = await connection.query(LIST_TABLES_SQL, [schemaName, MAX_METADATA_ROWS + 1]);
    if (rows.length > MAX_METADATA_ROWS) {
      throw resourceListTooLarge();
    }
    return groupTableRows(rows);
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw metadataUnavailable();
  } finally {
    await connection.close();
  }
}

async function createUserConnection(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<LakebasePostgresConnection> {
  requireCallerToken(caller);
  const userName = caller.email?.trim();
  if (!userName) {
    throw new ApplicationError(
      403,
      "lakebase_user_identity_unavailable",
      "Lakebase user identity is unavailable",
      "The signed-in Databricks session must include an email identity that has a Lakebase PostgreSQL role.",
    );
  }

  const resourceName = endpointResourceName(projectId, branchId, endpointId);
  const endpoint = await fetchLakebaseJson(
    new URL(`${POSTGRES_API_PATH}/${resourceName}`, workspaceHost),
    caller,
    fetchImplementation,
  );
  const endpointRecord = requireRecord(endpoint, "endpoint");
  const status = requireRecord(endpointRecord.status, "endpoint status");
  const hosts = requireRecord(status.hosts, "endpoint hosts");
  const host = readLakebaseHost(hosts.host);
  const database = await findDatabase(
    caller,
    projectId,
    branchId,
    databaseName,
    workspaceHost,
    fetchImplementation,
  );
  const credentialResponse = await postCredential(
    caller,
    resourceName,
    workspaceHost,
    fetchImplementation,
  );

  return connectionFactory({
    host,
    user: userName,
    database: database.databaseName,
    password: credentialResponse.token,
  });
}

async function findDatabase(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceLakebaseDatabaseResource> {
  const databases = await listDatabases(caller, projectId, branchId, workspaceHost, fetchImplementation);
  const database = databases.find((item) => item.databaseName === databaseName);
  if (!database) {
    throw new ApplicationError(
      404,
      "lakebase_database_not_found",
      "Lakebase database not found",
      "Select a database that is visible to your Databricks account.",
    );
  }
  return database;
}

async function postCredential(
  caller: CallerIdentity,
  endpointName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<{ token: string }> {
  const endpoint = new URL(`${POSTGRES_API_PATH}/credentials`, workspaceHost);
  const response = await fetchWorkspaceApi(endpoint, caller, fetchImplementation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: endpointName, ttl: OAUTH_TOKEN_TTL }),
  });
  const body = await readLakebaseJson(response);
  if (!isRecord(body) || typeof body.token !== "string" || body.token.length < 20 || body.token.length > 16_384) {
    throw invalidLakebaseResponse();
  }
  return { token: body.token };
}

async function listApiRecords(
  caller: CallerIdentity,
  path: string,
  collectionName: "projects" | "branches" | "endpoints" | "databases",
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown[]> {
  requireCallerToken(caller);
  const records: unknown[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const endpoint = new URL(path, workspaceHost);
    endpoint.searchParams.set("page_size", String(PAGE_SIZE));
    if (pageToken) {
      endpoint.searchParams.set("page_token", pageToken);
    }
    const response = await fetchWorkspaceApi(endpoint, caller, fetchImplementation, {}, signal);
    const body = await readLakebaseJson(response, signal);
    if (!isRecord(body)) {
      throw invalidLakebaseResponse();
    }
    const values = body[collectionName];
    if (!Array.isArray(values)) {
      throw invalidLakebaseResponse();
    }
    records.push(...values);
    if (records.length > PAGE_SIZE * MAX_PAGES) {
      throw resourceListTooLarge();
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) {
      return records;
    }
    if (seenTokens.has(pageToken)) {
      throw invalidLakebaseResponse();
    }
    seenTokens.add(pageToken);
  }

  throw resourceListTooLarge();
}

async function fetchLakebaseJson(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
): Promise<unknown> {
  const response = await fetchWorkspaceApi(endpoint, caller, fetchImplementation);
  return readLakebaseJson(response);
}

async function fetchWorkspaceApi(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  requestInit: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      ...requestInit,
      method: requestInit.method ?? "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
        ...requestInit.headers,
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApplicationError(
      502,
      "lakebase_unavailable",
      "Lakebase is unavailable",
      "Lakebase resources could not be loaded. Try again shortly.",
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
      "lakebase_access_denied",
      "Lakebase access is not available",
      "Confirm the app has the `postgres` user authorization scope and that you have Lakebase project and database permissions.",
    );
  }
  if (!response.ok) {
    throw new ApplicationError(
      502,
      "lakebase_request_failed",
      "Lakebase request failed",
      "Lakebase resources could not be loaded. Try again shortly.",
    );
  }
  return response;
}

async function readLakebaseJson(response: Response, signal?: AbortSignal): Promise<unknown> {
  let responseText: string;
  try {
    responseText = await readBoundedResponseText(response, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalidLakebaseResponse();
  }
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw invalidLakebaseResponse();
  }
}

async function readBoundedResponseText(response: Response, signal?: AbortSignal): Promise<string> {
  if (!response.body) {
    throw invalidLakebaseResponse();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw invalidLakebaseResponse();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw invalidLakebaseResponse();
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
    throw invalidLakebaseResponse();
  }
}

function readProject(value: unknown): WorkspaceLakebaseProjectResource {
  const record = requireRecord(value, "project");
  const projectId = readResourceId(record.project_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const spec = isRecord(record.spec) ? record.spec : {};
  const displayName = readSafeLabel(status.display_name ?? spec.display_name ?? projectId);
  return { projectId, displayName };
}

function readBranch(value: unknown): WorkspaceLakebaseBranchResource {
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

function readEndpoint(value: unknown): WorkspaceLakebaseEndpointResource {
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

function readDatabase(value: unknown): WorkspaceLakebaseDatabaseResource {
  const record = requireRecord(value, "database");
  const databaseId = readResourceId(record.database_id ?? readLastResourceId(record.name));
  const status = isRecord(record.status) ? record.status : {};
  const databaseName = readResourceId(status.postgres_database ?? databaseId);
  return { databaseId, databaseName };
}

function readSchemaRow(value: unknown): string {
  const record = requireRecord(value, "schema metadata");
  return readSafeLabel(record.schema_name);
}

function groupTableRows(rows: unknown[]): WorkspaceLakebaseTableResource[] {
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

function createPostgresConnection(
  options: LakebasePostgresConnectionOptions,
): LakebasePostgresConnection {
  const poolConfig: PoolConfig = {
    host: options.host,
    port: POSTGRES_PORT,
    user: options.user,
    database: options.database,
    password: options.password,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: PG_TIMEOUT_MS,
    query_timeout: PG_TIMEOUT_MS,
    statement_timeout: PG_TIMEOUT_MS,
    idleTimeoutMillis: PG_TIMEOUT_MS,
  };
  const pool = new Pool(poolConfig);
  return {
    query: async (statement, parameters) => {
      const result = await pool.query(statement, [...parameters]);
      return result.rows;
    },
    close: async () => pool.end(),
  };
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

function branchPath(projectId: string, branchId: string): string {
  return `${PROJECTS_PATH}/${encodeResourceId(projectId)}/branches/${encodeResourceId(branchId)}`;
}

function endpointResourceName(projectId: string, branchId: string, endpointId: string): string {
  return `projects/${encodeResourceId(projectId)}/branches/${encodeResourceId(branchId)}/endpoints/${encodeResourceId(endpointId)}`;
}

function encodeResourceId(value: string): string {
  return encodeURIComponent(readResourceId(value));
}

function readResourceId(value: unknown): string {
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

function readSafeLabel(value: unknown): string {
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

function readLakebaseHost(value: unknown): string {
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

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw invalidLakebaseResponse();
  }
  return value;
}

function requireRecord(value: unknown, _description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidLakebaseResponse();
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortByLabel(
  items: WorkspaceLakebaseProjectResource[],
): WorkspaceLakebaseProjectResource[] {
  return items.sort((left, right) =>
    left.displayName.localeCompare(right.displayName) || left.projectId.localeCompare(right.projectId),
  );
}

function invalidLakebaseResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_invalid_response",
    "Invalid Lakebase response",
    "Lakebase returned an invalid resource response.",
  );
}

function invalidLakebaseRequest(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_lakebase_resource_request",
    "Invalid Lakebase resource request",
    "Select a valid Lakebase resource from the current workspace.",
  );
}

function resourceListTooLarge(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_resource_list_too_large",
    "Lakebase resource list is too large",
    "Lakebase returned more metadata than this request can safely read.",
  );
}

function metadataUnavailable(): ApplicationError {
  return new ApplicationError(
    502,
    "lakebase_metadata_unavailable",
    "Lakebase metadata is unavailable",
    "Confirm your Lakebase database role can view this schema and try again.",
  );
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
