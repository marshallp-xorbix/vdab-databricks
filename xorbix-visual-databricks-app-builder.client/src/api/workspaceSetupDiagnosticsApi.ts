import {
  WorkspaceSetupDiagnostics,
  type IWorkspaceSetupDiagnostics,
  type DefaultSqlWarehouseStatus,
  type LakebaseBindingStatus,
  type WorkspaceAuthorizationStatus,
} from "../models/WorkspaceSetupDiagnostics";

const WORKSPACE_SETUP_DIAGNOSTICS_PATH = "/api/v1/setup/diagnostics";

/** Runs an explicit, read-only setup check against the installed workspace. */
export async function getWorkspaceSetupDiagnostics(
  signal?: AbortSignal,
): Promise<WorkspaceSetupDiagnostics> {
  const response = await fetch(WORKSPACE_SETUP_DIAGNOSTICS_PATH, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return new WorkspaceSetupDiagnostics(parseDiagnostics(await response.json()));
}

function parseDiagnostics(value: unknown): IWorkspaceSetupDiagnostics {
  if (
    !isRecord(value) ||
    !isRecord(value.lakebase) ||
    !isRecord(value.defaultSqlWarehouse) ||
    !isRecord(value.authorization)
  ) {
    throw invalidResponse();
  }

  const lakebase = value.lakebase;
  const defaultSqlWarehouse = value.defaultSqlWarehouse;
  const authorization = value.authorization;

  if (
    !isLakebaseStatus(lakebase.status) ||
    !isStringArray(lakebase.configuredFields) ||
    !isStringArray(lakebase.missingFields) ||
    typeof lakebase.message !== "string" ||
    !isDefaultSqlWarehouseStatus(defaultSqlWarehouse.status) ||
    typeof defaultSqlWarehouse.message !== "string" ||
    !isAuthorizationStatus(authorization.status) ||
    !isStringArray(authorization.requestedScopes) ||
    !isStringArray(authorization.effectiveScopes) ||
    !isStringArray(authorization.consentedScopes) ||
    !isStringArray(authorization.missingScopes) ||
    typeof authorization.message !== "string"
  ) {
    throw invalidResponse();
  }

  return {
    lakebase: {
      status: lakebase.status,
      configuredFields: lakebase.configuredFields,
      missingFields: lakebase.missingFields,
      message: lakebase.message,
    },
    defaultSqlWarehouse: {
      status: defaultSqlWarehouse.status,
      message: defaultSqlWarehouse.message,
    },
    authorization: {
      status: authorization.status,
      requestedScopes: authorization.requestedScopes,
      effectiveScopes: authorization.effectiveScopes,
      consentedScopes: authorization.consentedScopes,
      missingScopes: authorization.missingScopes,
      message: authorization.message,
    },
  };
}

function isDefaultSqlWarehouseStatus(
  value: unknown,
): value is DefaultSqlWarehouseStatus {
  return value === "configured" || value === "invalid" ||
    value === "missing" || value === "local-test";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isLakebaseStatus(value: unknown): value is LakebaseBindingStatus {
  return (
    value === "configured" ||
    value === "incomplete" ||
    value === "missing" ||
    value === "local-test"
  );
}

function isAuthorizationStatus(
  value: unknown,
): value is WorkspaceAuthorizationStatus {
  return (
    value === "verified" ||
    value === "missing-scopes" ||
    value === "unavailable" ||
    value === "local-test"
  );
}

function invalidResponse(): Error {
  return new Error(
    "The installed workspace returned invalid setup diagnostics.",
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") {
      return responseBody.detail;
    }
    if (isRecord(responseBody) && typeof responseBody.title === "string") {
      return responseBody.title;
    }
  } catch {
    // Fall back to a status-only message when no problem document is available.
  }

  return `Could not check workspace setup (HTTP ${response.status}).`;
}
