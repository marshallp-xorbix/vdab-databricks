import { BaseApi } from "./BaseApi";
import type { AppStatusResponse } from "../models";
import type {
  DatabricksApp,
  UpdateAppResourcesRequest,
  UpdateAppResourcesResponse,
} from "../models/DatabricksAppModels";
import {
  AppActionApiControllerName,
  AppActionRouteSegment,
} from "../types/appActionApiRoutes";

export class AppActionApi extends BaseApi {
  async getAppStatus(appId: number): Promise<AppStatusResponse> {
    return this.get<AppStatusResponse>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.Status}`,
    );
  }

  async getAppDetails(appId: number): Promise<DatabricksApp> {
    return this.get<DatabricksApp>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.Details}`,
    );
  }

  async startApp(appId: number): Promise<AppStatusResponse> {
    return this.post<AppStatusResponse>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.Start}`,
    );
  }

  async stopApp(appId: number): Promise<AppStatusResponse> {
    return this.post<AppStatusResponse>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.Stop}`,
    );
  }

  async updateAppResources(
    appId: number,
    body: UpdateAppResourcesRequest,
  ): Promise<UpdateAppResourcesResponse> {
    return this.put<UpdateAppResourcesResponse>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.Resources}`,
      body,
    );
  }

  async listDatabricksAppNames(
    appId: number,
    workspaceConnectionId: number,
  ): Promise<{ appNames: string[] }> {
    const params = new URLSearchParams({
      workspaceConnectionId: String(workspaceConnectionId),
    });
    return this.get<{ appNames: string[] }>(
      `/api/${AppActionApiControllerName}/${appId}/${AppActionRouteSegment.DatabricksAppNames}?${params.toString()}`,
    );
  }

  /** Lists Databricks app names for a workspace connection without a local VDAB app id (e.g. create-app flow). */
  async listDatabricksAppNamesByWorkspace(
    workspaceConnectionId: number,
  ): Promise<{ appNames: string[] }> {
    const params = new URLSearchParams({
      workspaceConnectionId: String(workspaceConnectionId),
    });
    return this.get<{ appNames: string[] }>(
      `/api/${AppActionApiControllerName}/${AppActionRouteSegment.DatabricksAppNames}?${params.toString()}`,
    );
  }
}

export const appActionApi = new AppActionApi();
