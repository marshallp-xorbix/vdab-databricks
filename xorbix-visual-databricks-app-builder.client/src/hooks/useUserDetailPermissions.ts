import { useLocation } from "react-router-dom";
import { useIdentity } from "../context/IdentityContext";
import { canManageSeatsAsAdminOrGlobal, TenantRoleSlug } from "../types/tenantRole";
import { useCurrentTenant } from "./useCurrentTenant";

/**
 * The viewer's effective permissions for a user-detail page, derived from the
 * route surface (tenant vs global admin) and the relationship between the
 * caller and the viewed user (self vs other). Membership — not
 * `ApplicationUser.tenantId` — is the only tenant relationship that matters.
 */
export interface IUserDetailPermissions {
  /** True when the page is rendered on the tenant seat-management surface. */
  isTenantMode: boolean;
  /** True when the caller holds the global Administrator role. */
  isGlobalAdmin: boolean;
  /** True when the caller is viewing their own record. */
  isSelf: boolean;
  /**
   * Account-level edits (email, password, settings, lock, deactivate).
   * Self-service or global Administrator only — tenant membership does not grant this.
   */
  canEditAccount: boolean;
  /**
   * Tenant membership administration (role, remove, suspend/resume) for other
   * members of the caller's tenant on the tenant surface. Requires tenant Admin
   * (or global Administrator).
   */
  canManageMembership: boolean;
  /** Global Identity role management (global-admin surface only). */
  canManageGlobalRoles: boolean;
  /**
   * Per-tenant role management across every tenant the viewed user belongs to
   * (global-admin surface only). Lets an administrator change the user's role in
   * each of their tenants independently, alongside the global roles.
   */
  canManageAllTenantRoles: boolean;
  /** Tenant membership role management (tenant mode, anyone but yourself). */
  canManageTenantRole: boolean;
  /** Destructive identity delete/purge (global-admin surface only). */
  canDeleteUser: boolean;
  /** True when the viewed member is the current tenant owner. */
  isViewedUserOwner: boolean;
  /** True when the caller is the current tenant owner (tenant surface only). */
  isCurrentUserOwner: boolean;
  /** True when the viewer may transfer ownership to another member. */
  canTransferOwnership: boolean;
  /**
   * True when the viewed member is the tenant owner on the tenant surface, so
   * destructive actions (deactivate, lock, remove) are gated until ownership is
   * transferred. Applies to every viewer, including the owner themselves.
   */
  ownerProtected: boolean;
  /** Re-fetches the current tenant so owner-derived flags reflect a transfer. */
  refreshOwner: () => Promise<void>;
  /** Mode-aware back-navigation target. */
  backTo: string;
  /** Mode-aware back-navigation label. */
  backLabel: string;
}

/**
 * Computes the viewer's permissions for the user-detail page, including
 * tenant-owner gating. The current tenant is loaded internally (only in tenant
 * mode) so owner-derived flags stay consistent with the route surface.
 *
 * @param viewedUserId The id of the user being viewed, or null while loading.
 */
export function useUserDetailPermissions(
  viewedUserId: string | null,
): IUserDetailPermissions {
  const location = useLocation();
  const { user: currentUser } = useIdentity();

  const isTenantMode = location.pathname.startsWith("/account/seats");
  const isGlobalAdmin =
    currentUser?.roles.includes(TenantRoleSlug.Administrator) ?? false;
  const callerUserId = currentUser?.userId ?? null;

  // Tenant ownership drives the owner badge and gates owner-only actions. Loaded
  // only in tenant mode (the global-admin surface manages ownership elsewhere).
  const { ownerId, refresh: refreshOwner } = useCurrentTenant(isTenantMode);

  const isSelf =
    !!currentUser && !!viewedUserId && currentUser.userId === viewedUserId;

  // Account administration is self-service or Xorbix-only (Phase 4 / §10).
  const canEditAccount = isGlobalAdmin || isSelf;
  // Membership administration: tenant surface + tenant Admin (or global admin) + not self.
  const canManageMembership =
    isTenantMode &&
    !isSelf &&
    canManageSeatsAsAdminOrGlobal(currentUser?.tenantRole, isGlobalAdmin);
  const canManageGlobalRoles = isGlobalAdmin && !isTenantMode;
  const canManageAllTenantRoles = isGlobalAdmin && !isTenantMode;
  const canManageTenantRole = canManageMembership;
  const canDeleteUser = isGlobalAdmin && !isTenantMode;

  // Tenant-owner gating: the owner badge and owner-only actions derive from the
  // current tenant owner and the viewer/viewed relationship.
  const isViewedUserOwner = !!ownerId && ownerId === viewedUserId;
  const isCurrentUserOwner = !!ownerId && ownerId === callerUserId;
  // The tenant owner or a global administrator may transfer ownership.
  const canTransferOwnership =
    isTenantMode && (isCurrentUserOwner || isGlobalAdmin);
  // In tenant mode the owner is protected from destructive actions (deactivate,
  // lock, remove) for everyone — including the owner themselves — until ownership
  // is transferred. The global administration surface manages the owner elsewhere.
  const ownerProtected = isTenantMode && isViewedUserOwner;

  const backTo = isTenantMode ? "/account/seats" : "/administration/users";
  const backLabel = isTenantMode ? "Back to Seats" : "Back to Users";

  return {
    isTenantMode,
    isGlobalAdmin,
    isSelf,
    canEditAccount,
    canManageMembership,
    canManageGlobalRoles,
    canManageAllTenantRoles,
    canManageTenantRole,
    canDeleteUser,
    isViewedUserOwner,
    isCurrentUserOwner,
    canTransferOwnership,
    ownerProtected,
    refreshOwner,
    backTo,
    backLabel,
  };
}
