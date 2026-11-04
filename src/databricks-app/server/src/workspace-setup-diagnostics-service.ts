import type { CallerIdentity, WorkspaceSetupDiagnostics } from "./contracts.ts";
import type { WorkspaceSetupDiagnosticsClient } from "./workspace-setup-diagnostics-client.ts";
import { isValidSqlWarehouseId } from "./sql-warehouse-app-resource-binding.ts";

const LAKEBASE_REQUIRED_ENVIRONMENT_FIELDS = [
  "LAKEBASE_ENDPOINT",
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGSSLMODE",
] as const;

/** Runtime values used only to report resource presence, never returned to callers. */
export type WorkspaceSetupEnvironment = Readonly<
  Record<string, string | undefined>
>;

/** Application boundary for setup status and caller-specific authorization checks. */
export interface WorkspaceSetupDiagnosticsProvider {
  getDiagnostics(caller: CallerIdentity): Promise<WorkspaceSetupDiagnostics>;
}

/** Combines safe install configuration with caller-authorized scope diagnostics. */
export class WorkspaceSetupDiagnosticsService implements WorkspaceSetupDiagnosticsProvider {
  private readonly workspaceSetupDiagnosticsClient: WorkspaceSetupDiagnosticsClient;
  private readonly environment: WorkspaceSetupEnvironment;

  constructor(
    workspaceSetupDiagnosticsClient: WorkspaceSetupDiagnosticsClient,
    environment: WorkspaceSetupEnvironment,
  ) {
    this.workspaceSetupDiagnosticsClient = workspaceSetupDiagnosticsClient;
    this.environment = environment;
  }

  /** Reports bound Lakebase inputs and checks scopes only when the caller requests it. */
  async getDiagnostics(
    caller: CallerIdentity,
  ): Promise<WorkspaceSetupDiagnostics> {
    const lakebase = getLakebaseBindingDiagnostics(
      this.environment,
      caller.authenticationMode,
    );
    const defaultSqlWarehouse = getDefaultSqlWarehouseDiagnostics(
      this.environment,
      caller.authenticationMode,
    );
    const authorization =
      caller.authenticationMode === "local-test"
        ? getLocalTestAuthorizationDiagnostics()
        : await this.workspaceSetupDiagnosticsClient.getAuthorizationDiagnostics(
            caller,
          );

    return { lakebase, defaultSqlWarehouse, authorization };
  }
}

function getDefaultSqlWarehouseDiagnostics(
  environment: WorkspaceSetupEnvironment,
  authenticationMode: CallerIdentity["authenticationMode"],
): WorkspaceSetupDiagnostics["defaultSqlWarehouse"] {
  if (authenticationMode === "local-test") {
    return {
      status: "local-test",
      message:
        "Local test mode does not verify an installed-workspace SQL warehouse.",
    };
  }

  const warehouseId = environment.DATABRICKS_SQL_WAREHOUSE_ID?.trim();
  if (!warehouseId) {
    return {
      status: "missing",
      message:
        "No default SQL warehouse is configured. Unity Catalog generated apps need this setting; Lakebase-only projects do not.",
    };
  }
  if (!isValidSqlWarehouseId(warehouseId)) {
    return {
      status: "invalid",
      message:
        "The configured SQL warehouse identifier has an unsupported format. The identifier is not shown here.",
    };
  }
  return {
    status: "configured",
    message:
      "A workspace SQL warehouse identifier is present. This checks configuration only; it does not verify the resource or user permissions.",
  };
}

function getLakebaseBindingDiagnostics(
  environment: WorkspaceSetupEnvironment,
  authenticationMode: CallerIdentity["authenticationMode"],
): WorkspaceSetupDiagnostics["lakebase"] {
  if (authenticationMode === "local-test") {
    return {
      status: "local-test",
      configuredFields: [],
      missingFields: [],
      message:
        "Local test mode uses in-memory storage and does not verify a Databricks Lakebase binding.",
    };
  }

  const configuredFields = LAKEBASE_REQUIRED_ENVIRONMENT_FIELDS.filter(
    (field) => environment[field]?.trim(),
  );
  const missingFields = LAKEBASE_REQUIRED_ENVIRONMENT_FIELDS.filter(
    (field) => !environment[field]?.trim(),
  );
  const status =
    missingFields.length === 0
      ? "configured"
      : configuredFields.length === 0
        ? "missing"
        : "incomplete";

  return {
    status,
    configuredFields: [...configuredFields],
    missingFields: [...missingFields],
    message:
      status === "configured"
        ? "Lakebase connection inputs are present. This checks configuration only; it does not test grants, connectivity, or database durability."
        : status === "missing"
          ? "Lakebase connection inputs are missing. Add the customer-owned database as the `postgres` App resource and verify the App environment configuration."
          : "Some Lakebase connection inputs are missing. Review the `postgres` App resource and its injected connection environment before using the builder.",
  };
}

function getLocalTestAuthorizationDiagnostics(): WorkspaceSetupDiagnostics["authorization"] {
  return {
    status: "local-test",
    requestedScopes: [],
    effectiveScopes: [],
    consentedScopes: [],
    missingScopes: [],
    message:
      "Local test mode does not contact Databricks or verify user scopes and consent.",
  };
}
