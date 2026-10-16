/** Warnings from appSettings mapping (e.g. unknown resource type keys). */
export interface AppSettingsWarning {
  code: string;
  message: string;
  resourceIndex?: number | null;
  unknownTypeKey?: string | null;
}

/**
 * Normalized resource row from GET /api/AppActions/{id}/details → appSettings.resources.
 * JSON uses camelCase (matches ASP.NET Core defaults).
 */
export interface NormalizedAppResource {
  kind: string;
  name: string;
  description: string;
  sqlWarehouse?: SqlWarehouseResource | null;
  job?: JobResource | null;
  database?: DatabaseResource | null;
  secret?: SecretResource | null;
  experiment?: ExperimentResource | null;
  genieSpace?: GenieSpaceResource | null;
  servingEndpoint?: ServingEndpointResource | null;
  ucSecurable?: UcSecurableResource | null;
}

export interface AppSettingsDetails {
  resources: NormalizedAppResource[];
  computeSize: string;
  warnings: AppSettingsWarning[];
}

/** PUT /api/AppActions/{id}/resources request (camelCase JSON). */
export interface UpdateAppResourcesRequest {
  resources: NormalizedAppResource[];
  expectedUpdateTime: string;
}

/** Response after updating resources — rehydrate app settings from Databricks. */
export interface UpdateAppResourcesResponse {
  updateTime: string;
  appSettings: AppSettingsDetails;
}

export interface DatabricksApp {
  name: string;
  description?: string;
  url?: string;
  creator?: string;
  create_time?: string;
  update_time?: string;
  compute_size?: string;
  resources?: DatabricksAppResource[];
  appSettings?: AppSettingsDetails;
  active_deployment?: DatabricksAppDeployment;
  pending_deployment?: DatabricksAppDeployment;
  app_status?: DatabricksAppStatus;
  compute_status?: DatabricksAppStatus;
  service_principal_id?: number;
  service_principal_name?: string;
  service_principal_client_id?: string;
}

export interface DatabricksAppResource {
  name: string;
  description?: string;
  // Each resource type has its own object key
  sql_warehouse?: SqlWarehouseResource;
  job?: JobResource;
  database?: DatabaseResource;
  secret?: SecretResource;
  experiment?: ExperimentResource;
  genie_space?: GenieSpaceResource;
  serving_endpoint?: ServingEndpointResource;
  uc_securable?: UcSecurableResource;
}

export interface SqlWarehouseResource {
  id: string;
  permission: string; // e.g. "CAN_MANAGE"
}

export interface JobResource {
  id: string;
  permission: string;
}

export interface DatabaseResource {
  database_name: string;
  database_display_name?: string;
  instance_name?: string;
  permission: string;
}

export interface SecretResource {
  key: string;
  scope: string;
  permission: string;
}

export interface ExperimentResource {
  experiment_id: string;
  permission: string;
}

export interface GenieSpaceResource {
  name: string;
  space_id: string;
  permission: string;
}

export interface ServingEndpointResource {
  name: string;
  permission: string;
}

export interface UcSecurableResource {
  securable_full_name: string;
  securable_type: string; // e.g. "VOLUME"
  permission: string;
}

export interface DatabricksAppDeployment {
  deployment_id: string;
  mode: string;
  status: DatabricksAppStatus;
  create_time: string;
  update_time: string;
  source_code_path?: string;
  deployment_artifacts?: {
    source_code_path?: string;
  };
  env_vars?: DatabricksAppEnvVar[];
}

export interface DatabricksAppEnvVar {
  name: string;
  value: string;
  value_from?: string;
}

export interface DatabricksAppStatus {
  state: string; // e.g. "SUCCEEDED", "DEPLOYING", "ERROR", "RUNNING"
  message?: string;
}
