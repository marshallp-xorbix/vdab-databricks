import type {
  IAuthResponse,
  ICreateTenantRequest,
  IRemovedTenantMember,
  ITenant,
  ITenantMemberRoleResponse,
  ITenantMembership,
} from "../models";
import { BaseApi } from "../providers/BaseApi";

/**
 * Wire shape of `GET /api/Tenant`. Mirrors `PaginatedTenantsResponse` on the server.
 * Phase 3 (TenantManagement) is expected to promote this to a dedicated model file.
 */
export interface IPaginatedTenantsResponse {
  tenants: ITenant[];
  totalCount: number;
  skip: number;
  take: number;
}

export interface IUpdateTenantRequest {
  displayName: string;
  tenantName?: string;
  invoiceName?: string | null;
  invoiceEmail?: string | null;
  ownerId?: string | null;
  subscriptionTier?: string | null;
  maxUsers?: number;
  maxPublishedApps?: number;
  maxWorkspaceConnections?: number;
}

export interface ITenantUsageStats {
  tenantId: string;
  displayName: string;
  subscriptionTier: string;
  userCount: number;
  appCount: number;
  connectionCount: number;
  maxUsers: number;
  maxPublishedApps: number;
  maxWorkspaceConnections: number;
}

export class TenantApi extends BaseApi {
  async getMyTenants(): Promise<ITenantMembership[]> {
    return this.get<ITenantMembership[]>("/api/Tenant/my-tenants");
  }

  /**
   * Lists all tenants. Backend requires global Administrator role.
   * Used by audit-log filter dropdowns and (later) the Tenant Management page.
   */
  async getAllTenants(
    skip: number = 0,
    take: number = 200,
  ): Promise<IPaginatedTenantsResponse> {
    const search = new URLSearchParams({
      skip: skip.toString(),
      take: take.toString(),
    });
    return this.get<IPaginatedTenantsResponse>(
      `/api/Tenant?${search.toString()}`,
    );
  }

  async getTenantById(tenantId: string): Promise<ITenant> {
    return this.get<ITenant>(`/api/Tenant/${tenantId}`);
  }

  async updateTenantById(
    tenantId: string,
    request: IUpdateTenantRequest,
  ): Promise<ITenant> {
    return this.put<ITenant>(`/api/Tenant/${tenantId}`, request);
  }

  async updateCurrentTenant(request: IUpdateTenantRequest): Promise<ITenant> {
    return this.put<ITenant>("/api/Tenant/current", request);
  }

  /**
   * Gets the caller's current tenant, including its `ownerId`. Used to surface
   * the tenant-owner indicator and gate owner-only actions in the UI.
   */
  async getCurrentTenant(): Promise<ITenant> {
    return this.get<ITenant>("/api/Tenant/current");
  }

  /**
   * Transfers ownership of the caller's current tenant to another active member.
   * Only the current tenant owner (or a global administrator) may call this; the
   * server promotes the new owner to tenant Admin when needed.
   */
  async transferOwnership(targetUserId: string): Promise<ITenant> {
    return this.put<ITenant>("/api/Tenant/owner", { targetUserId });
  }

  async getTenantUsageById(tenantId: string): Promise<ITenantUsageStats> {
    return this.get<ITenantUsageStats>(`/api/Tenant/${tenantId}/usage`);
  }

  /**
   * Extends a tenant's trial end date. Requires the global Administrator role.
   */
  async extendTrial(tenantId: string, newTrialEndDate: Date): Promise<void> {
    await this.post<void>(`/api/Tenant/${tenantId}/trial/extend`, {
      newTrialEndDate: newTrialEndDate.toISOString(),
    });
  }

  async createTenant(request: ICreateTenantRequest): Promise<ITenant> {
    return this.post<ITenant>("/api/Tenant", request);
  }

  /**
   * Creates an Incomplete personal workspace for a Detached user (no live memberships).
   * Does not clear account tombstones. Caller should switch into the new tenant afterward.
   */
  async createPersonalWorkspace(): Promise<ITenant> {
    return this.post<ITenant>("/api/Tenant/personal-workspace");
  }

  async switchTenant(tenantId: string): Promise<IAuthResponse> {
    return this.post<IAuthResponse>(`/api/Tenant/switch/${tenantId}`);
  }

  async setDefaultTenant(tenantId: string): Promise<void> {
    await this.put<void>(`/api/Tenant/default/${tenantId}`);
  }

  /**
   * Gets a member's role within the caller's current tenant. Requires the caller
   * to be a tenant Admin or higher in that tenant; scoped server-side to the active tenant.
   */
  async getMemberRole(userId: string): Promise<ITenantMemberRoleResponse> {
    return this.get<ITenantMemberRoleResponse>(
      `/api/Tenant/members/${userId}/role`,
    );
  }

  /**
   * Updates a member's role within the caller's current tenant. Requires the caller
   * to be a tenant Admin or higher; the caller may not assign a role above their own level
   * or change their own role. Scoped server-side to the active tenant.
   */
  async updateMemberRole(
    userId: string,
    role: string,
  ): Promise<ITenantMemberRoleResponse> {
    return this.put<ITenantMemberRoleResponse>(
      `/api/Tenant/members/${userId}/role`,
      { role },
    );
  }

  /**
   * Updates a member's role within an explicitly specified tenant. Requires the
   * caller to be a global Administrator, who may manage a user's role in any
   * tenant the user belongs to — including tenants the administrator is not a
   * member of. The global `Administrator` role cannot be assigned here.
   */
  async updateMemberRoleInTenant(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<ITenantMemberRoleResponse> {
    return this.put<ITenantMemberRoleResponse>(
      `/api/Tenant/${tenantId}/members/${userId}/role`,
      { role },
    );
  }

  /**
   * Adds an existing user to a tenant with a tenant-scoped role. Requires the
   * global Administrator role. Does not purchase seats; may assign an open seat
   * when the tenant already has seat management capacity.
   */
  async addMemberToTenant(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<ITenantMemberRoleResponse> {
    return this.post<ITenantMemberRoleResponse>(
      `/api/Tenant/${tenantId}/members`,
      { userId, role },
    );
  }

  /**
   * Removes a member from an explicitly specified tenant. Requires the global
   * Administrator role. Does not change payment or subscription tier. Frees any
   * occupied seat (the seat remains for reassignment).
   */
  async removeMemberFromTenant(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.delete<void>(`/api/Tenant/${tenantId}/members/${userId}`);
  }

  /**
   * Removes a member from the caller's current tenant. Requires the caller to be a
   * tenant Admin or higher; the caller may not remove themselves or a member who outranks
   * them. Ends the membership and frees the seat (the seat remains for reassignment).
   * Does not deactivate or otherwise modify the user's VDAB account. Scoped
   * server-side to the active tenant.
   */
  async removeMember(userId: string): Promise<void> {
    await this.delete<void>(`/api/Tenant/members/${userId}`);
  }

  /**
   * Suspends a live membership in the caller's current tenant (membership-level
   * block). Does not touch account fields.
   */
  async suspendMember(userId: string): Promise<ITenantMemberRoleResponse> {
    return this.post<ITenantMemberRoleResponse>(
      `/api/Tenant/members/${userId}/suspend`,
    );
  }

  /**
   * Resumes a suspended membership in the caller's current tenant.
   */
  async resumeMember(userId: string): Promise<ITenantMemberRoleResponse> {
    return this.post<ITenantMemberRoleResponse>(
      `/api/Tenant/members/${userId}/resume`,
    );
  }

  /**
   * Lists soft-deleted memberships (removed members) for the caller's current tenant.
   */
  async getRemovedMembers(): Promise<IRemovedTenantMember[]> {
    return this.get<IRemovedTenantMember[]>("/api/Tenant/members/removed");
  }

  /**
   * Marks a tenant inactive (reversible). Cancels Stripe at period end and revokes
   * sessions for users whose only tenant is this one. Global Administrator only.
   */
  async deactivateTenant(tenantId: string): Promise<void> {
    await this.post<void>(`/api/Tenant/${tenantId}/deactivate`);
  }

  /**
   * Reactivates a previously deactivated tenant. Does not resurrect a canceled
   * Stripe subscription. Global Administrator only.
   */
  async reactivateTenant(tenantId: string): Promise<void> {
    await this.post<void>(`/api/Tenant/${tenantId}/reactivate`);
  }

  /**
   * Cancels the tenant's Stripe subscription. When `immediate` is true the
   * subscription ends now; otherwise at the current period end.
   * Global Administrator only.
   */
  async cancelTenantSubscription(
    tenantId: string,
    immediate: boolean = false,
  ): Promise<void> {
    const search = new URLSearchParams({ immediate: immediate.toString() });
    await this.post<void>(
      `/api/Tenant/${tenantId}/cancel-subscription?${search.toString()}`,
    );
  }

  /**
   * Soft-deletes a tenant and cascades to memberships, apps, connections, seats,
   * and pending invites. Cancels Stripe immediately and disables sole-tenant users.
   * Global Administrator only.
   */
  async softDeleteTenant(tenantId: string): Promise<void> {
    await this.delete<void>(`/api/Tenant/${tenantId}`);
  }

  /**
   * Hard-deletes a tenant and all owned rows from the database. Cancels Stripe
   * immediately and disables sole-tenant users. Global Administrator only.
   */
  async purgeTenantData(tenantId: string): Promise<void> {
    await this.delete<void>(`/api/Tenant/${tenantId}/purge`);
  }
}

export const tenantApi = new TenantApi();
