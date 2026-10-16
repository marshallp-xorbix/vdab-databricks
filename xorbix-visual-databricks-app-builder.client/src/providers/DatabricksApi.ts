import { BaseApi } from "./BaseApi";
import {
  DatabricksConnection,
  DatabricksConnectionStatusDto,
  OAuthCodeExchangeRequest,
  UpdateWorkspaceRefreshTokenRequest,
  type IDeployAppRequest,
  type IDeployAppResponse,
  type ICreateDatabricksConnectionRequest,
  type IUpdateDatabricksConnectionRequest,
  type IExportBundle,
  type IImportConnectionRequest,
  type IImportElementResult,
} from "../models";
import type { DatabricksTokenResponse } from "../types/oauth";

/**
 * API client for Databricks connection operations
 */
export class DatabricksApi extends BaseApi {
  /**
   * Fetch all Databricks workspaces for the current user's tenant
   */
  async getWorkspacesByTenant(): Promise<DatabricksConnection[]> {
    return this.get<DatabricksConnection[]>("/api/DatabricksConnection/tenant");
  }

  /**
   * Fetch all Databricks workspaces for the current user's tenant with per-user auth status
   */
  async getWorkspacesByTenantWithStatus(): Promise<DatabricksConnectionStatusDto[]> {
    return this.get<DatabricksConnectionStatusDto[]>(
      "/api/DatabricksConnection/tenant/status",
    );
  }

  /**
   * Create a new Databricks workspace connection for the current tenant.
   */
  async createWorkspace(
    request: ICreateDatabricksConnectionRequest,
  ): Promise<DatabricksConnection> {
    return this.post<DatabricksConnection>("/api/DatabricksConnection", request);
  }

  /**
   * Update an existing Databricks workspace connection by primary key.
   */
  async updateWorkspace(
    connectionId: number,
    request: IUpdateDatabricksConnectionRequest,
  ): Promise<DatabricksConnection> {
    return this.put<DatabricksConnection>(
      `/api/DatabricksConnection/${connectionId}`,
      request,
    );
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeToken(
    request: OAuthCodeExchangeRequest,
  ): Promise<DatabricksTokenResponse> {
    return this.post<DatabricksTokenResponse>(
      "/api/databricks/exchange-token",
      request,
    );
  }

  /**
   * Deploy app to Databricks
   */
  async deployApp(request: IDeployAppRequest): Promise<IDeployAppResponse> {
    return this.post<IDeployAppResponse>("/api/databricks/deploy", request);
  }

  /**
   * Update refresh token for a workspace connection
   */
  async updateRefreshToken(
    request: UpdateWorkspaceRefreshTokenRequest,
  ): Promise<void> {
    await this.post(
      "/api/DatabricksConnection/UpdateWorkspaceRefreshToken",
      request,
    );
  }

  /**
   * Disconnect the current user from a workspace by revoking their refresh token
   */
  async disconnectWorkspace(workspaceConnectionId: number): Promise<void> {
    await this.post(
      `/api/DatabricksConnection/${workspaceConnectionId}/disconnect`,
      {},
    );
  }

  /**
   * Export every Databricks connection in the current tenant. Global admin only.
   */
  async exportConnections(): Promise<IExportBundle> {
    return this.get<IExportBundle>("/api/DatabricksConnection/export");
  }

  /**
   * Export a single Databricks connection. Global admin only.
   */
  async exportConnection(id: number): Promise<IExportBundle> {
    return this.get<IExportBundle>(`/api/DatabricksConnection/${id}/export`);
  }

  /**
   * Import a single Databricks connection into the current tenant. Global admin only.
   */
  async importConnection(
    request: IImportConnectionRequest,
  ): Promise<IImportElementResult> {
    return this.post<IImportElementResult>(
      "/api/DatabricksConnection/import",
      request,
    );
  }
}

// Export a singleton instance
export const databricksApi = new DatabricksApi();
