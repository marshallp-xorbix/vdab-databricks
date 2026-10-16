/**
 * Wire shape of the tenant member-role endpoints. Mirrors
 * `TenantMemberRoleResponse` on the server.
 */
export interface ITenantMemberRoleResponse {
  userId: string;
  tenantId: string;
  role: string;
  /** Active | Suspended | Ended */
  status: string;
}
