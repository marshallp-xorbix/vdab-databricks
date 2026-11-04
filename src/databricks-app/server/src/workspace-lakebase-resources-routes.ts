import { ApplicationError } from "./application-error.ts";

export type WorkspaceLakebaseResourcesRoute =
  | { type: "projects" }
  | { type: "branches"; projectId: string }
  | { type: "endpoints"; projectId: string; branchId: string }
  | { type: "databases"; projectId: string; branchId: string }
  | {
      type: "schemas";
      projectId: string;
      branchId: string;
      endpointId: string;
      databaseName: string;
    }
  | {
      type: "tables";
      projectId: string;
      branchId: string;
      endpointId: string;
      databaseName: string;
      schemaName: string;
    };

const LAKEBASE_PATH = "/api/v1/workspace/lakebase";
const MAX_RESOURCE_ID_LENGTH = 255;

/** Matches current-workspace Lakebase discovery routes and rejects authority input. */
export function matchWorkspaceLakebaseResourcesRoute(
  method: string,
  requestUrl: URL,
): WorkspaceLakebaseResourcesRoute | null {
  if (method !== "GET") {
    return null;
  }

  if (requestUrl.pathname === `${LAKEBASE_PATH}/projects`) {
    requireOnlyQueryNames(requestUrl, []);
    return { type: "projects" };
  }

  if (requestUrl.pathname === `${LAKEBASE_PATH}/branches`) {
    requireOnlyQueryNames(requestUrl, ["projectId"]);
    return { type: "branches", projectId: readResourceId(requestUrl, "projectId") };
  }

  if (requestUrl.pathname === `${LAKEBASE_PATH}/endpoints` || requestUrl.pathname === `${LAKEBASE_PATH}/databases`) {
    requireOnlyQueryNames(requestUrl, ["projectId", "branchId"]);
    const route = {
      projectId: readResourceId(requestUrl, "projectId"),
      branchId: readResourceId(requestUrl, "branchId"),
    };
    return requestUrl.pathname.endsWith("/endpoints")
      ? { type: "endpoints", ...route }
      : { type: "databases", ...route };
  }

  if (requestUrl.pathname === `${LAKEBASE_PATH}/schemas`) {
    requireOnlyQueryNames(requestUrl, ["projectId", "branchId", "endpointId", "databaseName"]);
    return {
      type: "schemas",
      projectId: readResourceId(requestUrl, "projectId"),
      branchId: readResourceId(requestUrl, "branchId"),
      endpointId: readResourceId(requestUrl, "endpointId"),
      databaseName: readResourceId(requestUrl, "databaseName"),
    };
  }

  if (requestUrl.pathname === `${LAKEBASE_PATH}/tables`) {
    requireOnlyQueryNames(requestUrl, ["projectId", "branchId", "endpointId", "databaseName", "schemaName"]);
    return {
      type: "tables",
      projectId: readResourceId(requestUrl, "projectId"),
      branchId: readResourceId(requestUrl, "branchId"),
      endpointId: readResourceId(requestUrl, "endpointId"),
      databaseName: readResourceId(requestUrl, "databaseName"),
      schemaName: readResourceId(requestUrl, "schemaName"),
    };
  }

  return null;
}

function requireOnlyQueryNames(requestUrl: URL, allowedNames: string[]): void {
  const queryNames = [...requestUrl.searchParams.keys()];
  if (
    queryNames.some((queryName) => !allowedNames.includes(queryName)) ||
    allowedNames.some((queryName) => requestUrl.searchParams.getAll(queryName).length !== 1)
  ) {
    throw invalidResourceRequest();
  }
}

function readResourceId(requestUrl: URL, propertyName: string): string {
  const value = requestUrl.searchParams.get(propertyName);
  if (
    value === null ||
    value.length < 1 ||
    value.length > MAX_RESOURCE_ID_LENGTH ||
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
    "invalid_lakebase_resource_request",
    "Invalid Lakebase resource request",
    "Select valid Lakebase resources from the current workspace.",
  );
}
