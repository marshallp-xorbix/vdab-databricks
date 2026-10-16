/**
 * Role helpers for gating UI to global administrators.
 */

/** The global Identity role name that grants system-wide administration. */
const GLOBAL_ADMINISTRATOR_ROLE = "administrator";

/**
 * Determines whether the given user holds the global Administrator role.
 *
 * @param user - The current user, or a minimal shape exposing global `roles`.
 * @returns `true` when the user is a global administrator; otherwise `false`.
 */
export function isGlobalAdministrator(
  user: { roles?: string[] } | null | undefined,
): boolean {
  if (!user?.roles) {
    return false;
  }

  return user.roles.some(
    (role) => role.toLowerCase() === GLOBAL_ADMINISTRATOR_ROLE,
  );
}
