import type { CallerIdentity } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  invalidLakebaseRequest,
  invalidLakebaseResponse,
  isRecord,
  readNextPageToken,
  readResourceId,
  requireRecord,
  resourceListTooLarge,
} from "./workspace-lakebase-resource-readers.ts";

export const POSTGRES_API_PATH = "/api/2.0/postgres";
export const PROJECTS_PATH = `${POSTGRES_API_PATH}/projects`;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const MAX_RESPONSE_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 15_000;

interface LakebaseApiResponse {
  projects?: unknown;
  branches?: unknown;
  endpoints?: unknown;
  databases?: unknown;
  next_page_token?: unknown;
  status?: unknown;
  token?: unknown;
}

export function requireCallerToken(caller: CallerIdentity): void {
  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }
}

export function branchPath(projectId: string, branchId: string): string {
  return `${PROJECTS_PATH}/${encodeResourceId(projectId)}/branches/${encodeResourceId(branchId)}`;
}

export function endpointResourceName(projectId: string, branchId: string, endpointId: string): string {
  return `projects/${encodeResourceId(projectId)}/branches/${encodeResourceId(branchId)}/endpoints/${encodeResourceId(endpointId)}`;
}

export function encodeResourceId(value: string): string {
  return encodeURIComponent(readResourceId(value));
}
export async function listApiRecords(
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

export async function fetchLakebaseJson(
  endpoint: URL,
  caller: CallerIdentity,
  fetchImplementation: typeof fetch,
): Promise<unknown> {
  const response = await fetchWorkspaceApi(endpoint, caller, fetchImplementation);
  return readLakebaseJson(response);
}

export async function fetchWorkspaceApi(
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

export async function readLakebaseJson(response: Response, signal?: AbortSignal): Promise<unknown> {
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
