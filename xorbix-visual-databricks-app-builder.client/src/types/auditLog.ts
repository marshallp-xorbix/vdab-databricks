//TODO: This file is a bit of a catch-all for audit log related types. Consider splitting into multiple files, grouping in directory with `AuditLog.ts`

/**
 * Action types that can appear in the audit log. The canonical list is owned by
 * the backend; this enum is the subset the UI surfaces for filtering. Keep the
 * string values aligned with `AuditLog.ActionType` values written by the server.
 */
export const AUDIT_ACTION_TYPES = [
  "Login",
  "Logout",
  "PasswordReset",
  "Lockout",
  "Create",
  "Update",
  "Delete",
  "Publish",
  "ConnectionChange",
  "RoleChange",
  "TenantSwitch",
] as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export const SECURITY_EVENT_ACTION_TYPES: AuditActionType[] = [
  "Login",
  "Logout",
  "PasswordReset",
  "Lockout",
  "RoleChange",
  "TenantSwitch",
];

/**
 * Severity levels the audit log writes. Matches `AuditLog.Severity` on the server.
 */
export const AUDIT_SEVERITIES = [
  "Info",
  "Warning",
  "Error",
  "Critical",
] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/**
 * The scope an audit grid runs under. Drives column visibility, default filters,
 * and which `userId` / `tenantId` are pinned on the server query.
 *
 * - `all` — admin global view; user + tenant columns shown.
 * - `user` — single-user view (UserDetail Activity Log); hides the User column.
 * - `tenant` — single-tenant view (TenantDetail Activity Log); hides the Tenant column.
 */
export type AuditScope =
  | { kind: "all" }
  | { kind: "user"; userId: string; tenantId?: string }
  | { kind: "tenant"; tenantId: string };

/**
 * Optional filters layered on top of the scope. Action type + severity arrays
 * are intersection-OR (any match passes); date range is inclusive on both ends.
 */
export interface AuditLogFilters {
  actionTypes?: AuditActionType[];
  severities?: AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  /**
   * Narrows results to a specific user. Only meaningful on the `all` scope —
   * `user` scope already pins the user, and `tenant` scope ignores user filters.
   */
  userId?: string;
  /**
   * Narrows results to a specific tenant. Only meaningful on the `all` scope —
   * `tenant` scope already pins the tenant, and `user` scope ignores tenant filters.
   */
  tenantId?: string;
  /** Free-text search applied client-side over loaded rows. */
  searchTerm?: string;
}
