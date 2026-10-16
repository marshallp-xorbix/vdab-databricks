import { BaseApi } from "./BaseApi";
import type { IAddRoleRequest } from "../models";
import {
  StripeEventLogDto,
  type IPaginatedStripeEventLogsResponse,
} from "../models/StripeEventLog";

/**
 * API client for Management operations (roles, settings)
 */
export class ManagementApi extends BaseApi {
  /**
   * Gets all roles in the application
   */
  async getRoles(): Promise<string[]> {
    return this.get<string[]>("/api/Management/roles");
  }

  /**
   * Adds a new role to the application
   */
  async addRole(request: IAddRoleRequest): Promise<string> {
    // The controller returns CreatedAtAction with the role name in the body
    return this.post<string>("/api/Management/roles", request);
  }

  /**
   * Deletes a role from the application
   */
  async removeRole(roleName: string): Promise<void> {
    return this.delete<void>(
      `/api/Management/roles/${encodeURIComponent(roleName)}`
    );
  }

  /**
   * Gets a page of Stripe webhook event logs for diagnostics.
   */
  async getStripeEventLogs(
    pageNumber: number = 1,
    pageSize: number = 25,
  ): Promise<IPaginatedStripeEventLogsResponse> {
    const search = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });
    const response = await this.get<IPaginatedStripeEventLogsResponse>(
      `/api/Management/stripe/event-logs?${search.toString()}`,
    );
    return {
      ...response,
      logs: response.logs.map((log) => new StripeEventLogDto(log)),
    };
  }
}

// Export a singleton instance
export const managementApi = new ManagementApi();
