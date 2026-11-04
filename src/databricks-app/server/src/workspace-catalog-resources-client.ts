import type {
  CallerIdentity,
  WorkspaceResource,
  WorkspaceTableResource,
  WorkspaceTableSummariesResult,
  WorkspaceTableSummaryResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  fetchWorkspaceResource,
  invalidWorkspaceResourceResponse,
  normalizeWorkspaceHost,
  readWorkspaceResourceResponse,
} from "./workspace-resource-api.ts";

const CATALOGS_PATH = "/api/2.1/unity-catalog/catalogs";
const SCHEMAS_PATH = "/api/2.1/unity-catalog/schemas";
const VOLUMES_PATH = "/api/2.1/unity-catalog/volumes";
const TABLES_PATH = "/api/2.1/unity-catalog/tables";
const TABLE_SUMMARIES_PATH = "/api/2.1/unity-catalog/table-summaries";
const MAX_RESOURCE_PAGES = 50;
const RESOURCE_PAGE_SIZE = 1000;
const TABLE_PAGE_SIZE = 50;
const TABLE_SUMMARY_PAGE_SIZE = 100;
const MAX_TABLE_SUMMARY_ITEMS = 500;

/** Lists Unity Catalog resources using the acting user's forwarded token. */
export interface WorkspaceCatalogResourcesClient {
  listCatalogs(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceResource[]>;
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
}

interface DatabricksTableRecord {
  name?: unknown;
  data_source_format?: unknown;
  columns?: unknown;
}

/** Creates a Unity Catalog client pinned to the configured workspace origin. */
export function createWorkspaceCatalogResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceCatalogResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listCatalogs: (caller, signal) =>
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
    listTables: (caller, catalogName, schemaName) =>
      listTables(
        caller,
        catalogName,
        schemaName,
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
  };
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
  const items: WorkspaceResource[] = [];
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(path, workspaceHost);
    endpoint.searchParams.set("max_results", String(RESOURCE_PAGE_SIZE));
    fixedQuery.forEach((value, key) => endpoint.searchParams.set(key, value));
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);

    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      undefined,
      signal,
    );
    const body = await readWorkspaceResourceResponse(response, signal);
    const values = body[collectionName];
    if (!Array.isArray(values)) throw invalidWorkspaceResourceResponse();

    items.push(...values.map(readWorkspaceResource));
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) return sortResources(items);
    if (requestedTokens.has(pageToken)) {
      throw invalidWorkspaceResourceResponse();
    }
    requestedTokens.add(pageToken);
  }

  throw listTooLarge("resource");
}

async function listTables(
  caller: CallerIdentity,
  catalogName: string,
  schemaName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceTableResource[]> {
  const items: WorkspaceTableResource[] = [];
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(TABLES_PATH, workspaceHost);
    endpoint.searchParams.set(
      "catalog_name",
      validateResourceName(catalogName),
    );
    endpoint.searchParams.set("schema_name", validateResourceName(schemaName));
    endpoint.searchParams.set("max_results", String(TABLE_PAGE_SIZE));
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);

    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
    );
    const body = await readWorkspaceResourceResponse(response);
    if (!Array.isArray(body.tables)) throw invalidWorkspaceResourceResponse();

    items.push(...body.tables.map(readWorkspaceTable));
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) {
      return items.sort((left, right) => left.name.localeCompare(right.name));
    }
    if (requestedTokens.has(pageToken)) {
      throw invalidWorkspaceResourceResponse();
    }
    requestedTokens.add(pageToken);
  }

  throw listTooLarge("table");
}

async function listTableSummaries(
  caller: CallerIdentity,
  catalogName: string,
  maxItems: number,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceTableSummariesResult> {
  if (
    !Number.isInteger(maxItems) ||
    maxItems < 1 ||
    maxItems > MAX_TABLE_SUMMARY_ITEMS
  ) {
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
    endpoint.searchParams.set(
      "catalog_name",
      validateResourceName(catalogName),
    );
    endpoint.searchParams.set(
      "max_results",
      String(Math.min(maxItems, TABLE_SUMMARY_PAGE_SIZE)),
    );
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);

    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the app's Unity Catalog user authorization and your permission to view these tables.",
      signal,
    );
    const body = await readWorkspaceResourceResponse(response, signal);
    if (!Array.isArray(body.tables)) throw invalidWorkspaceResourceResponse();

    const pageItems = body.tables.map(readWorkspaceTableSummary);
    const remainingItems = maxItems - items.size;
    for (const item of pageItems.slice(0, remainingItems)) {
      items.set(item.fullName, item);
    }

    pageToken = readNextPageToken(body.next_page_token);
    if (items.size >= maxItems) {
      return {
        items: sortTableSummaries([...items.values()]),
        hasMore: pageItems.length > remainingItems || pageToken !== null,
      };
    }
    if (!pageToken) {
      return { items: sortTableSummaries([...items.values()]), hasMore: false };
    }
    if (requestedTokens.has(pageToken)) {
      throw invalidWorkspaceResourceResponse();
    }
    requestedTokens.add(pageToken);
  }

  throw listTooLarge("table summary");
}

function readWorkspaceTableSummary(
  value: unknown,
): WorkspaceTableSummaryResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidWorkspaceResourceResponse();
  }
  const fullName = (value as { full_name?: unknown }).full_name;
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
    throw invalidWorkspaceResourceResponse();
  }
  return { fullName };
}

function sortTableSummaries(
  summaries: WorkspaceTableSummaryResource[],
): WorkspaceTableSummaryResource[] {
  return summaries.sort((left, right) =>
    left.fullName.localeCompare(right.fullName),
  );
}

function readWorkspaceResource(value: unknown): WorkspaceResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidWorkspaceResourceResponse();
  }
  const name = (value as { name?: unknown }).name;
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
    throw invalidWorkspaceResourceResponse();
  }
  return { name };
}

function readWorkspaceTable(value: unknown): WorkspaceTableResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidWorkspaceResourceResponse();
  }
  const record = value as DatabricksTableRecord;
  const name = readWorkspaceResource({ name: record.name }).name;
  const dataSourceFormat = record.data_source_format ?? null;
  if (!Array.isArray(record.columns)) throw invalidWorkspaceResourceResponse();

  const columns = record.columns.map((column) => {
    if (
      typeof column !== "object" ||
      column === null ||
      Array.isArray(column)
    ) {
      throw invalidWorkspaceResourceResponse();
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
      throw invalidWorkspaceResourceResponse();
    }
    return { name: columnName, type: columnType, dataType };
  });

  if (dataSourceFormat !== null && typeof dataSourceFormat !== "string") {
    throw invalidWorkspaceResourceResponse();
  }
  return { name, dataSourceFormat, columns };
}

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw invalidWorkspaceResourceResponse();
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

function listTooLarge(resourceType: string): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_resource_list_too_large",
    "Resource list is too large",
    `The workspace returned more ${resourceType} pages than this request can safely read.`,
  );
}
