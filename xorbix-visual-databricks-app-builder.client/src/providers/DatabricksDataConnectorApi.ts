import { BaseApi } from "./BaseApi";

export interface UnityCatalogTable {
  catalog: string;
  schema: string;
  table: string;
  fullName: string;
}

export interface DatabricksJob {
  jobId: string;
  jobName: string;
  creatorUserName?: string;
  jobType?: string;
}

export interface DatabricksSqlWarehouse {
  warehouseId: string;
  name: string;
}

export interface UnityCatalogColumn {
  name?: string;
  type?: string;
  nullable?: boolean;
  comment?: string;
}

export interface UnityCatalogTableDetails {
  catalogName?: string;
  schemaName?: string;
  name?: string;
  fullName?: string;
  columns?: UnityCatalogColumn[];
}

export interface LakebaseDatabaseInstance {
  name?: string;
  readWriteDns?: string;
  databaseName?: string;
}

/** Lakebase Compute database instance row for Databricks Apps database resources (not Unity Catalog). */
export interface LakebaseAppResourceDatabaseOption {
  instanceName: string;
  databaseName: string;
}

export interface LakebaseDatabaseCatalog {
  name?: string;
  databaseInstanceName?: string;
  databaseName?: string;
}

/** Display hints for Lakebase Autoscaling selector rows. */
export interface LakebaseAutoscalingSelectorDisplay {
  primaryLabel?: string;
  secondaryLabel?: string;
  searchText?: string;
}

export interface LakebaseAutoscalingEndpointOption {
  /** Postgres logical database name (e.g. databricks_postgres), not the compute id (ep-…). */
  postgresDatabaseName?: string;
  /**
   * Bare database_id for Databricks Apps postgres.database wire paths.
   * When set, prefer this for app resource database_name over the logical Postgres name.
   */
  appsDatabaseResourceId?: string;
  endpointName: string;
  endpointId: string;
  endpointType: string;
  autoscalingLimitMinCu?: number | null;
  autoscalingLimitMaxCu?: number | null;
  suspendTimeoutDuration?: string | null;
  effectiveStatus?: string | null;
  selectorDisplay?: LakebaseAutoscalingSelectorDisplay;
  /** Read-write endpoint ID used only for caller-scoped metadata reads. */
  metadataEndpointId?: string;
}

export interface LakebaseAutoscalingBranchOption {
  branchName: string;
  branchId: string;
  isDefault: boolean;
  endpoints: LakebaseAutoscalingEndpointOption[];
}

export interface LakebaseAutoscalingProjectOption {
  projectName: string;
  projectId: string;
  displayName: string;
  branches: LakebaseAutoscalingBranchOption[];
}

export interface LakebaseAutoscalingSelectorResponse {
  projects: LakebaseAutoscalingProjectOption[];
}

export interface DatabricksServingEndpointListItem {
  name: string;
}

export interface DatabricksExperimentListItem {
  experimentId: string;
  name: string;
}

export interface DatabricksGenieSpaceListItem {
  spaceId: string;
  name: string;
}

export class DatabricksDataConnectorApi extends BaseApi {
  async getUnityCatalogTables(
    workspaceConnectionId: number,
    catalog?: string,
    schema?: string,
  ): Promise<UnityCatalogTable[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    if (catalog) params.append("catalog", catalog);
    if (schema) params.append("schema", schema);

    return this.get<UnityCatalogTable[]>(
      `/api/DatabricksDataConnector/tables?${params}`,
    );
  }

  async getUnityCatalogCatalogs(
    workspaceConnectionId: number,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<string[]>(
      `/api/DatabricksDataConnector/catalogs?${params}`,
    );
  }

  async getUnityCatalogSchemas(
    workspaceConnectionId: number,
    catalog: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      catalog,
    });
    return this.get<string[]>(`/api/DatabricksDataConnector/schemas?${params}`);
  }

  async getUnityCatalogVolumes(
    workspaceConnectionId: number,
    catalog: string,
    schema: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      catalog,
      schema,
    });
    return this.get<string[]>(`/api/DatabricksDataConnector/volumes?${params}`);
  }

  async getJobs(workspaceConnectionId: number): Promise<DatabricksJob[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<DatabricksJob[]>(
      `/api/DatabricksDataConnector/jobs?${params}`,
    );
  }

  async getSqlWarehouses(
    workspaceConnectionId: number,
  ): Promise<DatabricksSqlWarehouse[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<DatabricksSqlWarehouse[]>(
      `/api/DatabricksDataConnector/sql-warehouses?${params}`,
    );
  }

  async getUnityCatalogTableDetails(
    workspaceConnectionId: number,
    catalog: string,
    schema: string,
    table: string,
  ): Promise<UnityCatalogTableDetails> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      catalog,
      schema,
      table,
    });
    return this.get<UnityCatalogTableDetails>(
      `/api/DatabricksDataConnector/table-details?${params}`,
    );
  }

  async getDatabaseInstances(
    workspaceConnectionId: number,
  ): Promise<LakebaseDatabaseInstance[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });

    return this.get<LakebaseDatabaseInstance[]>(
      `/api/DatabricksDataConnector/database-instances?${params}`,
    );
  }

  async getLakebaseAppResourceDatabaseOptions(
    workspaceConnectionId: number,
  ): Promise<LakebaseAppResourceDatabaseOption[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });

    return this.get<LakebaseAppResourceDatabaseOption[]>(
      `/api/DatabricksDataConnector/lakebase-app-resource-databases?${params}`,
    );
  }

  /**
   * Lakebase Autoscaling projects, branches, and endpoints (Postgres API).
   */
  async getLakebaseAutoscalingSelector(
    workspaceConnectionId: number,
  ): Promise<LakebaseAutoscalingSelectorResponse> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<LakebaseAutoscalingSelectorResponse>(
      `/api/DatabricksDataConnector/lakebase-autoscaling?${params}`,
    );
  }

  async getLakebaseAutoscalingDatabases(
    workspaceConnectionId: number,
    projectId: string,
    branchId: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      projectId,
      branchId,
    });
    return this.get<string[]>(
      `/api/DatabricksDataConnector/lakebase-autoscaling-databases?${params}`,
    );
  }

  async getLakebaseAutoscalingSchemas(
    workspaceConnectionId: number,
    projectId: string,
    branchId: string,
    databaseId: string,
    databaseName: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      projectId,
      branchId,
      databaseName,
    });
    if (databaseId.trim()) {
      params.append("databaseId", databaseId);
    }
    return this.get<string[]>(
      `/api/DatabricksDataConnector/lakebase-autoscaling-schemas?${params}`,
    );
  }

  async getLakebaseAutoscalingTables(
    workspaceConnectionId: number,
    projectId: string,
    branchId: string,
    databaseId: string,
    databaseName: string,
    schema: string,
  ): Promise<UnityCatalogTable[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      projectId,
      branchId,
      databaseName,
      schema,
    });
    if (databaseId.trim()) {
      params.append("databaseId", databaseId);
    }
    return this.get<UnityCatalogTable[]>(
      `/api/DatabricksDataConnector/lakebase-autoscaling-tables?${params}`,
    );
  }

  async getLakebaseAutoscalingTableDetails(
    workspaceConnectionId: number,
    projectId: string,
    branchId: string,
    databaseId: string,
    databaseName: string,
    schema: string,
    table: string,
  ): Promise<UnityCatalogTableDetails> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      projectId,
      branchId,
      databaseName,
      schema,
      table,
    });
    if (databaseId.trim()) {
      params.append("databaseId", databaseId);
    }
    return this.get<UnityCatalogTableDetails>(
      `/api/DatabricksDataConnector/lakebase-autoscaling-table-details?${params}`,
    );
  }

  async getLakebaseDatabaseCatalogs(
    workspaceConnectionId: number,
    catalogName: string,
  ): Promise<LakebaseDatabaseCatalog[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });

    return this.get<LakebaseDatabaseCatalog[]>(
      `/api/DatabricksDataConnector/database-catalogs/${encodeURIComponent(catalogName)}?${params}`,
    );
  }

  async getServingEndpoints(
    workspaceConnectionId: number,
  ): Promise<DatabricksServingEndpointListItem[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<DatabricksServingEndpointListItem[]>(
      `/api/DatabricksDataConnector/serving-endpoints?${params}`,
    );
  }

  async getExperiments(
    workspaceConnectionId: number,
  ): Promise<DatabricksExperimentListItem[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<DatabricksExperimentListItem[]>(
      `/api/DatabricksDataConnector/experiments?${params}`,
    );
  }

  async getGenieSpaces(
    workspaceConnectionId: number,
  ): Promise<DatabricksGenieSpaceListItem[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<DatabricksGenieSpaceListItem[]>(
      `/api/DatabricksDataConnector/genie-spaces?${params}`,
    );
  }

  async getSecretScopes(workspaceConnectionId: number): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
    });
    return this.get<string[]>(
      `/api/DatabricksDataConnector/secret-scopes?${params}`,
    );
  }

  /** Query uses `secretScope` (not `scope`) to avoid clashes with OAuth `scope`. */
  async getSecretKeys(
    workspaceConnectionId: number,
    secretScope: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      workspaceConnectionId: workspaceConnectionId.toString(),
      secretScope,
    });
    return this.get<string[]>(
      `/api/DatabricksDataConnector/secret-keys?${params}`,
    );
  }
}

export const databricksDataConnectorApi = new DatabricksDataConnectorApi();
