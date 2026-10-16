import type {
  ICreateTenantAiModelRequest,
  ITenantAiModel,
  IUpdateTenantAiModelRequest,
} from "../models/TenantAiModel";
import { BaseApi } from "../providers/BaseApi";

class TenantAiModelApi extends BaseApi {
  async list(): Promise<ITenantAiModel[]> {
    return this.get<ITenantAiModel[]>("/api/TenantAiModel");
  }

  async create(request: ICreateTenantAiModelRequest): Promise<ITenantAiModel> {
    return this.post<ITenantAiModel>("/api/TenantAiModel", request);
  }

  async update(
    id: number,
    request: IUpdateTenantAiModelRequest,
  ): Promise<ITenantAiModel> {
    return this.put<ITenantAiModel>(`/api/TenantAiModel/${id}`, request);
  }

  async remove(id: number): Promise<void> {
    await this.delete<void>(`/api/TenantAiModel/${id}`);
  }
}

export const tenantAiModelApi = new TenantAiModelApi();
