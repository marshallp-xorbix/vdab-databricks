import type {
  CallerIdentity,
  WorkspaceGenieSpaceResource,
  WorkspaceResource,
  WorkspaceServingEndpointResource,
  WorkspaceTableSummariesPage,
  WorkspaceTableSummariesResult,
  WorkspaceTableSummaryResource,
  WorkspaceTableResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

const CATALOGS_PATH = "/api/2.1/unity-catalog/catalogs";
const SCHEMAS_PATH = "/api/2.1/unity-catalog/schemas";
const VOLUMES_PATH = "/api/2.1/unity-catalog/volumes";
const TABLES_PATH = "/api/2.1/unity-catalog/tables";
const TABLE_SUMMARIES_PATH = "/api/2.1/unity-catalog/table-summaries";
const GENIE_SPACES_PATH = "/api/2.0/genie/spaces";
const SERVING_ENDPOINTS_PATH = "/api/2.0/serving-endpoints";
const MAX_RESOURCE_PAGES = 50;
const RESOURCE_PAGE_SIZE = 1000;
const TABLE_PAGE_SIZE = 50;
const TABLE_SUMMARY_PAGE_SIZE = 100;
const MAX_TABLE_SUMMARY_ITEMS = 500;
const GENIE_SPACE_PAGE_SIZE = 100;
const MAX_SERVING_ENDPOINTS = 1000;
const MAX_RESOURCE_RESPONSE_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const SPACE_ID_PATTERN = /^(?:[A-Fa-f0-9]{32}|[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12})$/;
const SERVING_ENDPOINT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,63}$/;

/** Lists resources under the acting user's identity in the installed workspace. */
export interface WorkspaceResourcesClient {
  listCatalogs(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceResource[]>;
  listTableSummaries(
    caller: CallerIdentity,
    catalogName: string,
    maxItems: number,
    signal?: AbortSignal,
  ): Promise<WorkspaceTableSummariesResult>;
  listSchemas(
    caller: CallerIdentity,
    catalogName: string,
  ): Promise<WorkspaceResource[]>;
  listVolumes(
    caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceResource[]>;
  listTables(
    caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceTableResource[]>;
  listGenieSpaces(caller: CallerIdentity): Promise<WorkspaceGenieSpaceResource[]>;
  listServingEndpoints(
    caller: CallerIdentity,
  ): Promise<WorkspaceServingEndpointResource[]>;
}

interface DatabricksResourceResponse {
  catalogs?: unknown;
  schemas?: unknown;
  volumes?: unknown;
  tables?: unknown;
  spaces?: unknown;
  endpoints?: unknown;
  next_page_token?: unknown;
}

interface DatabricksResourceRecord {
  name?: unknown;
}

interface DatabricksTableRecord extends DatabricksResourceRecord {
  data_source_format?: unknown;
  columns?: unknown;
}

interface DatabricksGenieSpaceRecord {
  space_id?: unknown;
  title?: unknown;
}

interface DatabricksServingEndpointRecord extends DatabricksResourceRecord {
  state?: unknown;
  permission_level?: unknown;
}

/** Creates a resource client pinned to the configured workspace origin. */
export function createWorkspaceResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);

  return {
    listCatalogs: async (caller, signal) =>
      listResources(
        caller,
        CATALOGS_PATH,
        "catalogs",
        new URLSearchParams(),
        pinnedWorkspaceHost,
        fetchImplementation,
        signal,
      ),
    listTableSummaries: (caller, catalogName, maxItems, signal) =>
      listTableSummaries(
        caller,
        catalogName,
        maxItems,
        pinnedWorkspaceHost,
        fetchImplementation,
        signal,
      ),
    listSchemas: async (caller, catalogName) =>
      listResources(
        caller,
        SCHEMAS_PATH,
        "schemas",
        queryWithCatalog(catalogName),
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
    listVolumes: async (caller, catalogName, schemaName) =>
      listResources(
        caller,
        VOLUMES_PATH,
        "volumes",
        queryWithCatalogAndSchema(catalogName, schemaName),
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
    listTables: async (caller, catalogName, schemaName) =>
      listTables(
        caller,
        catalogName,
        schemaName,
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
    listGenieSpaces: async (caller) =>
      listGenieSpaces(caller, pinnedWorkspaceHost, fetchImplementation),
    listServingEndpoints: async (caller) =>
      listServingEndpoints(caller, pinnedWorkspaceHost, fetchImplementation),
  };
}

async function listServingEndpoints(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceServingEndpointResource[]> {
  requireCallerToken(caller);
  const endpoint = new URL(SERVING_ENDPOINTS_PATH, workspaceHost);
  const response = await fetchResources(
    endpoint,
    caller,
    fetchImplementation,
    "Confirm the model-serving user authorization scope and your permission to query the serving endpoint.",
  );
  const responseBody = await readResourceResponse(response);
  if (!Array.isArray(responseBody.endpoints) || responseBody.endpoints.length > MAX_SERVING_ENDPOINTS) {
    throw invalidResourceResponse();
  }

  const items = new Map<string, WorkspaceServingEndpointResource>();
  for (const value of responseBody.endpoints) {
    const item = readWorkspaceServingEndpoint(value);
    items.set(item.name, item);
  }
  return [...items.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function listGenieSpaces(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceGenieSpaceResource[]> {
  requireCallerToken(caller);
  const items = new Map<string, WorkspaceGenieSpaceResource>();
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(GENIE_SPACES_PATH, workspaceHost);
    endpoint.searchParams.set("page_size", String(GENIE_SPACE_PAGE_SIZE));
    if (pageToken) {
      endpoint.searchParams.set("page_token", pageToken);
    }

    const response = await fetchResources(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the Genie user authorization scope and your access to the Genie space.",
    );
    const responseBody = await readResourceResponse(response);
    if (!Array.isArray(responseBody.spaces)) {
      throw invalidResourceResponse();
    }

    for (const value of responseBody.spaces) {
      const space = readWorkspaceGenieSpace(value);
      items.set(space.spaceId.toLowerCase(), space);
    }

    pageToken = readNextPageToken(responseBody.next_page_token);
    if (!pageToken) {
      return [...items.values()].sort((left, right) =>
        left.title.localeCompare(right.title) || left.spaceId.localeCompare(right.spaceId),
      );
    }
    if (requestedTokens.has(pageToken)) {
      throw invalidResourceResponse();
    }
    requestedTokens.add(pageToken);
  }

  throw new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    "The workspace returned more resource pages than this request can safely read.",
  );
}

async function listResources(
  caller: CallerIdentity,
  path: string,
  collectionName: "catalogs" | "schemas" | "volumes",
  fixedQuery: URLSearchParams,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceResource[]> {
  requireCallerToken(caller);
  const items: WorkspaceResource[] = [];
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(path, workspaceHost);
    endpoint.searchParams.set("max_results", String(RESOURCE_PAGE_SIZE));
    fixedQuery.forEach((value, key) => endpoint.searchParams.set(key, value));

    if (pageToken) {
      endpoint.searchParams.set("page_token", pageToken);
    }

    const response = await fetchResources(endpoint, caller, fetchImplementation, undefined, signal);
    const responseBody = await readResourceResponse(response, signal);
    const values = responseBody[collectionName];

    if (!Array.isArray(values)) {
      throw invalidResourceResponse();
    }

    const pageItems = values.map(readWorkspaceResource);
    items.push(...pageItems);
    pageToken = readNextPageToken(responseBody.next_page_token);

    if (!pageToken) {
      return sortResources(items);
    }

    if (requestedTokens.has(pageToken)) {
      throw invalidResourceResponse();
    }

    requestedTokens.add(pageToken);
  }

  throw new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    "The workspace returned more resource pages than this request can safely read.",
  );
}

async function listTables(
  caller: CallerIdentity,
  catalogName: string,
  schemaName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceTableResource[]> {
  requireCallerToken(caller);
  const items: WorkspaceTableResource[] = [];
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(TABLES_PATH, workspaceHost);
    endpoint.searchParams.set("catalog_name", validateResourceName(catalogName));
    endpoint.searchParams.set("schema_name", validateResourceName(schemaName));
    endpoint.searchParams.set("max_results", String(TABLE_PAGE_SIZE));

    if (pageToken) {
      endpoint.searchParams.set("page_token", pageToken);
    }

    const response = await fetchResources(endpoint, caller, fetchImplementation);
    const responseBody = await readResourceResponse(response);
    if (!Array.isArray(responseBody.tables)) {
      throw invalidResourceResponse();
    }

    items.push(...responseBody.tables.map(readWorkspaceTable));
    pageToken = readNextPageToken(responseBody.next_page_token);
    if (!pageToken) {
      return items.sort((left, right) => left.name.localeCompare(right.name));
    }

    if (requestedTokens.has(pageToken)) {
      throw invalidResourceResponse();
    }
    requestedTokens.add(pageToken);
  }

  throw new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    "The workspace returned more table pages than this request can safely read.",
  );
}

async function listTableSummaries(
  caller: CallerIdentity,
  catalogName: string,
  maxItems: number,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceTableSummariesResult> {
  requireCallerToken(caller);
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_TABLE_SUMMARY_ITEMS) {
    throw new ApplicationError(
      400,
      "invalid_table_summary_limit",
      "Invalid table summary limit",
      "The table summary limit must be between 1 and 500.",
    );
  }

  const items = new Map<string, WorkspaceTableSummaryResource>();
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    signal?.throwIfAborted();
    const endpoint = new URL(TABLE_SUMMARIES_PATH, workspaceHost);
    endpoint.searchParams.set("catalog_name", validateResourceName(catalogName));
    endpoint.searchParams.set("max_results", String(Math.min(maxItems, TABLE_SUMMARY_PAGE_SIZE)));
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);

    const response = await fetchResources(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the app's Unity Catalog user authorization and your permission to view these tables.",
      signal,
    );
    const responseBody = await readResourceResponse(response, signal);
    if (!Array.isArray(responseBody.tables)) throw invalidResourceResponse();

    const pageItems = responseBody.tables.map(readWorkspaceTableSummary);
    const remainingItems = maxItems - items.size;
    for (const item of pageItems.slice(0, remainingItems)) {
      items.set(item.fullName, item);
    }

    pageToken = readNextPageToken(responseBody.next_page_token);
    if (items.size >= maxItems) {
      return {
        items: sortTableSummaries([...items.values()]),
        hasMore: pageItems.length > remainingItems || pageToken !== null,
      };
    }
    if (!pageToken) {
      return { items: sortTableSummaries([...items.values()]), hasMore: false };
    }
    if (requestedTokens.has(pageToken)) throw invalidResourceResponse();
    requestedTokens.add(pageToken);
  }

  throw new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    "The workspace returned more table summary pages than this request can safely read.",
  );
}

async function fetchResources(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
  permissionDetail: string | undefined = "Confirm the app has the required user authorization scope and that you can access this Unity Catalog resource.",
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response;

  try {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    response = await fetchImplementation(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
      },
      signal: requestSignal,
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

function readWorkspaceGenieSpace(value: unknown): WorkspaceGenieSpaceResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResourceResponse();
  }
  const record = value as DatabricksGenieSpaceRecord;
  if (
    typeof record.space_id !== "string" ||
    !SPACE_ID_PATTERN.test(record.space_id) ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 512 ||
    record.title.trim() !== record.title ||
    /[\u0000-\u001f\u007f]/.test(record.title)
  ) {
    throw invalidResourceResponse();
  }
  return { spaceId: record.space_id, title: record.title };
}

function readWorkspaceServingEndpoint(value: unknown): WorkspaceServingEndpointResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResourceResponse();
  }

  const record = value as DatabricksServingEndpointRecord;
  if (typeof record.name !== "string" || !SERVING_ENDPOINT_NAME_PATTERN.test(record.name)) {
    throw invalidResourceResponse();
  }

  const state = isRecord(record.state) ? record.state : null;
  const readiness = state?.ready === "READY"
    ? "ready"
    : typeof state?.ready === "string"
    ? "not-ready"
    : "unknown";
  const permissionLevel = record.permission_level === "CAN_VIEW" ||
      record.permission_level === "CAN_QUERY" ||
      record.permission_level === "CAN_MANAGE"
    ? record.permission_level
    : null;

  return { name: record.name, readiness, permissionLevel };
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

async function readResourceResponse(
  response: Response,
  signal?: AbortSignal,
): Promise<DatabricksResourceResponse> {
  let responseText: string;
  try {
    responseText = await readBoundedResponseText(response, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalidResourceResponse();
  }

  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    throw invalidResourceResponse();
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw invalidResourceResponse();
  }

  return body as DatabricksResourceResponse;
}

async function readBoundedResponseText(
  response: Response,
  signal?: AbortSignal,
): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESOURCE_RESPONSE_BYTES) {
    throw new Error("Workspace response exceeds the safe size limit.");
  }

  if (!response.body) {
    throw new Error("Workspace response body is missing.");
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
      if (byteLength > MAX_RESOURCE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Workspace response exceeds the safe size limit.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function readWorkspaceTableSummary(value: unknown): WorkspaceTableSummaryResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResourceResponse();
  }

  const record = value as { full_name?: unknown; catalog_name?: unknown; schema_name?: unknown; name?: unknown };
  const fullName = record.full_name;
  if (
    typeof fullName !== "string" ||
    fullName.length < 5 ||
    fullName.length > 768 ||
    fullName.trim() !== fullName ||
    fullName.split(".").length < 3 ||
    fullName.includes("/") ||
    fullName.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(fullName)
  ) {
    throw invalidResourceResponse();
  }

  return { fullName };
}

function sortTableSummaries(
  summaries: WorkspaceTableSummaryResource[],
): WorkspaceTableSummaryResource[] {
  return summaries.sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function readWorkspaceResource(value: unknown): WorkspaceResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResourceResponse();
  }

  const name = (value as DatabricksResourceRecord).name;
  if (
    typeof name !== "string" ||
    name.length < 1 ||
    name.length > 255 ||
    name.trim() !== name ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".." ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    throw invalidResourceResponse();
  }

  return { name };
}

function readWorkspaceTable(value: unknown): WorkspaceTableResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResourceResponse();
  }

  const record = value as DatabricksTableRecord;
  const name = readWorkspaceResource({ name: record.name }).name;
  const dataSourceFormat = record.data_source_format ?? null;
  if (!Array.isArray(record.columns)) {
    throw invalidResourceResponse();
  }

  const columns = record.columns.map((column) => {
    if (typeof column !== "object" || column === null || Array.isArray(column)) {
      throw invalidResourceResponse();
    }

    const columnRecord = column as {
      name?: unknown;
      type_name?: unknown;
      type_text?: unknown;
    };
    const columnName = columnRecord.name;
    const columnType = columnRecord.type_text ?? columnRecord.type_name ?? null;
    const dataType = columnRecord.type_name ?? null;
    if (
      typeof columnName !== "string" ||
      columnName.length < 1 ||
      columnName.length > 255 ||
      columnName.trim() !== columnName ||
      /[\u0000-\u001f\u007f]/.test(columnName) ||
      (columnType !== null && typeof columnType !== "string") ||
      (dataType !== null && typeof dataType !== "string")
    ) {
      throw invalidResourceResponse();
    }

    return { name: columnName, type: columnType, dataType };
  });

  if (dataSourceFormat !== null && typeof dataSourceFormat !== "string") {
    throw invalidResourceResponse();
  }

  return { name, dataSourceFormat, columns };
}

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > 2048) {
    throw invalidResourceResponse();
  }

  return value;
}

function queryWithCatalog(catalogName: string): URLSearchParams {
  const query = new URLSearchParams();
  query.set("catalog_name", validateResourceName(catalogName));
  return query;
}

function queryWithCatalogAndSchema(
  catalogName: string,
  schemaName: string,
): URLSearchParams {
  const query = queryWithCatalog(catalogName);
  query.set("schema_name", validateResourceName(schemaName));
  return query;
}

function validateResourceName(value: string): string {
  if (
    value.length < 1 ||
    value.length > 255 ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new ApplicationError(
      400,
      "invalid_workspace_resource_name",
      "Invalid workspace resource name",
      "Select a valid resource name from the current workspace.",
    );
  }

  return value;
}

function sortResources(items: WorkspaceResource[]): WorkspaceResource[] {
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResourceResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid Databricks response",
    "Databricks returned an invalid workspace resource response.",
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
