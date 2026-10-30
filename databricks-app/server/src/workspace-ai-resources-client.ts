import type {
  CallerIdentity,
  WorkspaceGenieSpaceResource,
  WorkspaceServingEndpointResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  fetchWorkspaceResource,
  invalidWorkspaceResourceResponse,
  isRecord,
  normalizeWorkspaceHost,
  readWorkspaceResourceResponse,
} from "./workspace-resource-api.ts";

const GENIE_SPACES_PATH = "/api/2.0/genie/spaces";
const SERVING_ENDPOINTS_PATH = "/api/2.0/serving-endpoints";
const MAX_RESOURCE_PAGES = 50;
const GENIE_SPACE_PAGE_SIZE = 100;
const MAX_SERVING_ENDPOINTS = 1000;
const SPACE_ID_PATTERN =
  /^(?:[A-Fa-f0-9]{32}|[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12})$/;
const SERVING_ENDPOINT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,63}$/;

/** Lists Genie spaces and serving endpoints with the acting user's token. */
export interface WorkspaceAiResourcesClient {
  listGenieSpaces(
    caller: CallerIdentity,
  ): Promise<WorkspaceGenieSpaceResource[]>;
  listServingEndpoints(
    caller: CallerIdentity,
  ): Promise<WorkspaceServingEndpointResource[]>;
}

/** Creates a workspace AI-resource client pinned to the installed workspace. */
export function createWorkspaceAiResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceAiResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listGenieSpaces: (caller) =>
      listGenieSpaces(caller, pinnedWorkspaceHost, fetchImplementation),
    listServingEndpoints: (caller) =>
      listServingEndpoints(caller, pinnedWorkspaceHost, fetchImplementation),
  };
}

async function listServingEndpoints(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceServingEndpointResource[]> {
  const response = await fetchWorkspaceResource(
    new URL(SERVING_ENDPOINTS_PATH, workspaceHost),
    caller,
    fetchImplementation,
    "Confirm the model-serving user authorization scope and your permission to query the serving endpoint.",
  );
  const body = await readWorkspaceResourceResponse(response);
  if (
    !Array.isArray(body.endpoints) ||
    body.endpoints.length > MAX_SERVING_ENDPOINTS
  ) {
    throw invalidWorkspaceResourceResponse();
  }

  const items = new Map<string, WorkspaceServingEndpointResource>();
  for (const value of body.endpoints) {
    const item = readWorkspaceServingEndpoint(value);
    items.set(item.name, item);
  }
  return [...items.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function listGenieSpaces(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceGenieSpaceResource[]> {
  const items = new Map<string, WorkspaceGenieSpaceResource>();
  const requestedTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_RESOURCE_PAGES; page += 1) {
    const endpoint = new URL(GENIE_SPACES_PATH, workspaceHost);
    endpoint.searchParams.set("page_size", String(GENIE_SPACE_PAGE_SIZE));
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);

    const response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      "Confirm the Genie user authorization scope and your access to the Genie space.",
    );
    const body = await readWorkspaceResourceResponse(response);
    if (!Array.isArray(body.spaces)) {
      throw invalidWorkspaceResourceResponse();
    }

    for (const value of body.spaces) {
      const space = readWorkspaceGenieSpace(value);
      items.set(space.spaceId.toLowerCase(), space);
    }
    pageToken = readNextPageToken(body.next_page_token);
    if (!pageToken) {
      return [...items.values()].sort(
        (left, right) =>
          left.title.localeCompare(right.title) ||
          left.spaceId.localeCompare(right.spaceId),
      );
    }
    if (requestedTokens.has(pageToken)) {
      throw invalidWorkspaceResourceResponse();
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

function readWorkspaceGenieSpace(value: unknown): WorkspaceGenieSpaceResource {
  if (!isRecord(value)) throw invalidWorkspaceResourceResponse();
  if (
    typeof value.space_id !== "string" ||
    !SPACE_ID_PATTERN.test(value.space_id) ||
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > 512 ||
    value.title.trim() !== value.title ||
    /[\u0000-\u001f\u007f]/.test(value.title)
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  return { spaceId: value.space_id, title: value.title };
}

function readWorkspaceServingEndpoint(
  value: unknown,
): WorkspaceServingEndpointResource {
  if (!isRecord(value)) throw invalidWorkspaceResourceResponse();
  if (
    typeof value.name !== "string" ||
    !SERVING_ENDPOINT_NAME_PATTERN.test(value.name)
  ) {
    throw invalidWorkspaceResourceResponse();
  }

  const state = isRecord(value.state) ? value.state : null;
  const readiness =
    state?.ready === "READY"
      ? "ready"
      : typeof state?.ready === "string"
        ? "not-ready"
        : "unknown";
  const permissionLevel =
    value.permission_level === "CAN_VIEW" ||
    value.permission_level === "CAN_QUERY" ||
    value.permission_level === "CAN_MANAGE"
      ? value.permission_level
      : null;
  if (value.task !== undefined && (typeof value.task !== "string" || value.task.length > 128 || /[\u0000-\u001f]/.test(value.task))) throw invalidWorkspaceResourceResponse();
  return { name: value.name, readiness, permissionLevel,
    ...(typeof value.task === "string" ? { task: value.task } : {}) };
}

function readNextPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw invalidWorkspaceResourceResponse();
  }
  return value;
}
