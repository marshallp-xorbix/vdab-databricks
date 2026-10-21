import { ApplicationError } from "./application-error.ts";

export type WorkspaceResourcesRoute =
  | { type: "catalogs" }
  | { type: "schemas"; catalogName: string }
  | { type: "volumes"; catalogName: string; schemaName: string }
  | { type: "tables"; catalogName: string; schemaName: string }
  | { type: "genieSpaces" }
  | { type: "servingEndpoints" };

const CATALOGS_PATH = "/api/v1/workspace/resources/catalogs";
const SCHEMAS_PATH = "/api/v1/workspace/resources/schemas";
const VOLUMES_PATH = "/api/v1/workspace/resources/volumes";
const TABLES_PATH = "/api/v1/workspace/resources/tables";
const GENIE_SPACES_PATH = "/api/v1/workspace/resources/genie-spaces";
const SERVING_ENDPOINTS_PATH = "/api/v1/workspace/resources/serving-endpoints";
const MAX_RESOURCE_NAME_LENGTH = 255;

/** Matches and validates the read-only current-workspace resource routes. */
export function matchWorkspaceResourcesRoute(
  method: string,
  requestUrl: URL,
): WorkspaceResourcesRoute | null {
  if (method !== "GET") {
    return null;
  }

  if (requestUrl.pathname === CATALOGS_PATH) {
    requireOnlyQueryNames(requestUrl, []);
    return { type: "catalogs" };
  }

  if (requestUrl.pathname === SCHEMAS_PATH) {
    requireOnlyQueryNames(requestUrl, ["catalogName"]);
    return {
      type: "schemas",
      catalogName: readResourceName(requestUrl, "catalogName"),
    };
  }

  if (requestUrl.pathname === VOLUMES_PATH) {
    requireOnlyQueryNames(requestUrl, ["catalogName", "schemaName"]);
    return {
      type: "volumes",
      catalogName: readResourceName(requestUrl, "catalogName"),
      schemaName: readResourceName(requestUrl, "schemaName"),
    };
  }

  if (requestUrl.pathname === TABLES_PATH) {
    requireOnlyQueryNames(requestUrl, ["catalogName", "schemaName"]);
    return {
      type: "tables",
      catalogName: readResourceName(requestUrl, "catalogName"),
      schemaName: readResourceName(requestUrl, "schemaName"),
    };
  }

  if (requestUrl.pathname === GENIE_SPACES_PATH) {
    requireOnlyQueryNames(requestUrl, []);
    return { type: "genieSpaces" };
  }

  if (requestUrl.pathname === SERVING_ENDPOINTS_PATH) {
    requireOnlyQueryNames(requestUrl, []);
    return { type: "servingEndpoints" };
  }

  return null;
}

function requireOnlyQueryNames(requestUrl: URL, allowedNames: string[]): void {
  const queryNames = [...requestUrl.searchParams.keys()];

  if (
    queryNames.some((queryName) => !allowedNames.includes(queryName)) ||
    allowedNames.some(
      (queryName) => requestUrl.searchParams.getAll(queryName).length !== 1,
    )
  ) {
    throw invalidResourceRequest();
  }
}

function readResourceName(requestUrl: URL, propertyName: string): string {
  const value = requestUrl.searchParams.get(propertyName);

  if (
    value === null ||
    value.length < 1 ||
    value.length > MAX_RESOURCE_NAME_LENGTH ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidResourceRequest();
  }

  return value;
}

function invalidResourceRequest(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_workspace_resource_request",
    "Invalid workspace resource request",
    "Select a valid catalog and schema from the current workspace.",
  );
}
