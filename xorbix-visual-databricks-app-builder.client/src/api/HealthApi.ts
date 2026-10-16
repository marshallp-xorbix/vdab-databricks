import { BaseApi } from "../providers/BaseApi";
import type { HealthResponse } from "../models/HealthCheck";

class HealthApi extends BaseApi {
  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health/details");
  }
}

export const healthApi = new HealthApi();
