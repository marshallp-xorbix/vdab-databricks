import { BaseApi } from "../providers/BaseApi";
import type { StatusResponse } from "../models/StatusModel";
class StatusApi extends BaseApi {
  async getStatus(): Promise<StatusResponse> {
    return this.get<StatusResponse>("/status");
  }
}

export const statusApi = new StatusApi();
