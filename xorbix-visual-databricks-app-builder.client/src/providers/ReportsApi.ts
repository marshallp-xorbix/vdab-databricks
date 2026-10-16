import type { IReportsStats } from "../models";
import { BaseApi } from "./BaseApi";

/**
 * API client for administrator reports.
 */
export class ReportsApi extends BaseApi {
  async getStats(): Promise<IReportsStats> {
    return this.get<IReportsStats>("/api/reports/stats");
  }
}

export const reportsApi = new ReportsApi();
