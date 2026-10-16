import {
  AppDto,
  type ICreateAppRequest,
  UpdateAppRequest,
  AppComponentDto,
  UpsertAppComponentRequest,
  UpsertBatchRequest,
  type IExportBundle,
  type IImportAppRequest,
  type IImportElementResult,
} from "../models";

import { BaseApi } from "./BaseApi";

/**
 * API client for app and component operations
 */
export class AppApi extends BaseApi {
  /**
   * Get app by ID
   */
  async getAppById(id: number): Promise<AppDto> {
    return this.get<AppDto>(`/api/App/${id}`);
  }

  /**
   * Get all apps for the current user's tenant
   */
  async getAppsByTenant(): Promise<AppDto[]> {
    return this.get<AppDto[]>("/api/App/tenant");
  }

  /**
   * Creates a VDAB app; the API orchestrates Databricks link or create per `databricksAppMode`.
   */
  async createApp(request: ICreateAppRequest): Promise<AppDto> {
    return this.post<AppDto>("/api/App", request);
  }

  /**
   * Update an existing app
   */
  async updateApp(id: number, request: UpdateAppRequest): Promise<void> {
    await this.put(`/api/App/${id}`, request);
  }

  /**
   * Get all components for an app, grouped by context
   */
  async getComponentsByAppId(appId: number): Promise<Record<string, AppComponentDto[]>> {
    return this.get<Record<string, AppComponentDto[]>>(`/api/AppComponent/app/${appId}`);
  }

  /**
   * Upsert multiple components in batch
   */
  async upsertComponents(
    appId: number,
    components: UpsertAppComponentRequest[]
  ): Promise<AppComponentDto[]> {
    const request: UpsertBatchRequest = {
      appId,
      components,
    };

    return this.post<AppComponentDto[]>(
      "/api/AppComponent/upsert-batch",
      request
    );
  }

  /**
   * Delete a component
   */
  async deleteComponent(id: number): Promise<void> {
    await this.delete(`/api/AppComponent/${id}`);
  }

  /**
   * Export every app (with components) in the current tenant. Global admin only.
   */
  async exportApps(): Promise<IExportBundle> {
    return this.get<IExportBundle>("/api/App/export");
  }

  /**
   * Export a single app (with components). Global admin only.
   */
  async exportApp(id: number): Promise<IExportBundle> {
    return this.get<IExportBundle>(`/api/App/${id}/export`);
  }

  /**
   * Import a single app into the current tenant. Global admin only.
   */
  async importApp(request: IImportAppRequest): Promise<IImportElementResult> {
    return this.post<IImportElementResult>("/api/App/import", request);
  }
}

// Export a singleton instance
export const appApi = new AppApi();
