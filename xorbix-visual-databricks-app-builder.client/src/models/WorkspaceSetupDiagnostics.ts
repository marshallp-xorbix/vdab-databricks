export type LakebaseBindingStatus =
  | "configured"
  | "incomplete"
  | "missing"
  | "local-test";

export type WorkspaceAuthorizationStatus =
  | "verified"
  | "missing-scopes"
  | "unavailable"
  | "local-test";

export type DefaultSqlWarehouseStatus =
  | "configured"
  | "invalid"
  | "missing"
  | "local-test";

export interface ILakebaseBindingDiagnostics {
  status: LakebaseBindingStatus;
  configuredFields: string[];
  missingFields: string[];
  message: string;
}

export interface IWorkspaceAuthorizationDiagnostics {
  status: WorkspaceAuthorizationStatus;
  requestedScopes: string[];
  effectiveScopes: string[];
  consentedScopes: string[];
  missingScopes: string[];
  message: string;
}

export interface IDefaultSqlWarehouseDiagnostics {
  status: "configured" | "invalid" | "missing" | "local-test";
  message: string;
}

export interface IWorkspaceSetupDiagnostics {
  lakebase: ILakebaseBindingDiagnostics;
  defaultSqlWarehouse: IDefaultSqlWarehouseDiagnostics;
  authorization: IWorkspaceAuthorizationDiagnostics;
}

/** Install-local setup state; never contains resource values or credentials. */
export class WorkspaceSetupDiagnostics implements IWorkspaceSetupDiagnostics {
  lakebase: ILakebaseBindingDiagnostics;
  defaultSqlWarehouse: IDefaultSqlWarehouseDiagnostics;
  authorization: IWorkspaceAuthorizationDiagnostics;

  constructor(source: IWorkspaceSetupDiagnostics) {
    this.lakebase = {
      ...source.lakebase,
      configuredFields: [...source.lakebase.configuredFields],
      missingFields: [...source.lakebase.missingFields],
    };
    this.defaultSqlWarehouse = { ...source.defaultSqlWarehouse };
    this.authorization = {
      ...source.authorization,
      requestedScopes: [...source.authorization.requestedScopes],
      effectiveScopes: [...source.authorization.effectiveScopes],
      consentedScopes: [...source.authorization.consentedScopes],
      missingScopes: [...source.authorization.missingScopes],
    };
  }
}
