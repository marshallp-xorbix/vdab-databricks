import { ApplicationError } from "./application-error.ts";

export type WorkspaceLakebaseProvisionedResourcesRoute =
  | { type: "instances" }
  | { type: "schemas"; instanceName: string; databaseName: string }
  | { type: "tables"; instanceName: string; databaseName: string; schemaName: string };

const PROVISIONED_LAKEBASE_PATH = "/api/v1/workspace/lakebase/provisioned";
const MAX_RESOURCE_NAME_LENGTH = 255;

/** Matches Provisioned Lakebase routes and rejects caller-supplied workspace authority. */
export function matchWorkspaceLakebaseProvisionedResourcesRoute(
  method: string,
  requestUrl: URL,
): WorkspaceLakebaseProvisionedResourcesRoute | null {
  if (method !== "GET") return null;

  if (requestUrl.pathname === `${PROVISIONED_LAKEBASE_PATH}/instances`) {
    requireOnlyQueryNames(requestUrl, []);
    return { type: "instances" };
  }
  if (requestUrl.pathname === `${PROVISIONED_LAKEBASE_PATH}/schemas`) {
    requireOnlyQueryNames(requestUrl, ["instanceName", "databaseName"]);
    return {
      type: "schemas",
      instanceName: readResourceName(requestUrl, "instanceName"),
      databaseName: readResourceName(requestUrl, "databaseName"),
    };
  }
  if (requestUrl.pathname === `${PROVISIONED_LAKEBASE_PATH}/tables`) {
    requireOnlyQueryNames(requestUrl, ["instanceName", "databaseName", "schemaName"]);
    return {
      type: "tables",
      instanceName: readResourceName(requestUrl, "instanceName"),
      databaseName: readResourceName(requestUrl, "databaseName"),
      schemaName: readResourceName(requestUrl, "schemaName"),
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
    "invalid_lakebase_provisioned_request",
    "Invalid Lakebase Provisioned resource request",
    "Select valid Lakebase resources from the installed workspace.",
  );
}
