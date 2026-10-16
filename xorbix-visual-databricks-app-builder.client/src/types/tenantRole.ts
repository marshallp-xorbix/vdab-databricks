/**
 * Tenant-scoped roles stored in `UserTenantMembership.Role`.
 * Distinct from the global ASP.NET Identity roles on `UserProfileResponse.roles`.
 */
export enum TenantRoleSlug {
  /** Global administrator (cross-tenant). Backed by Identity role of the same name. */
  Administrator = "Administrator",
  /** Tenant administrator. Full tenant control including seat management. */
  Admin = "Admin",
  /** Regular tenant member. */
  Developer = "Developer",
}

/**
 * Returns true when the given tenant role can manage seats (add/remove users, assign seats).
 */
export function canManageTenantSeats(tenantRole?: string | null): boolean {
  return (
    tenantRole === TenantRoleSlug.Administrator ||
    tenantRole === TenantRoleSlug.Admin
  );
}

/**
 * Returns true when the caller may manage seats: either they hold a tenant Admin
 * role in the active tenant, or they are a global Identity Administrator.
 */
export function canManageSeatsAsAdminOrGlobal(
  tenantRole: string | null | undefined,
  isGlobalAdministrator: boolean,
): boolean {
  return isGlobalAdministrator || canManageTenantSeats(tenantRole);
}
