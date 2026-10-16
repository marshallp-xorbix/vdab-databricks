import { GlobalRolesTab } from "./GlobalRolesTab";
import { UserTenantRolesSection } from "./UserTenantRolesSection";
import type { IUserTenantMembershipDto } from "../../models/UserTenantMembershipDto";

interface IGlobalRolesPanelProps {
  availableRoles: string[];
  selectedRoles: string[];
  rolesChanged: boolean;
  saving: boolean;
  onToggleRole: (role: string) => void;
  onReset: () => void;
  onSave: () => void;
  /** Whether to show the per-tenant role editor (global administrators only). */
  showTenantRoles: boolean;
  /** Every tenant the viewed user belongs to, with their role in each. */
  memberships: IUserTenantMembershipDto[];
  /** Saves the user's role within a tenant; resolves true on success. */
  onSaveTenantRole: (tenantId: string, role: string) => Promise<boolean>;
  /** Adds the user to a tenant; resolves true on success. */
  onAddToTenant: (tenantId: string, role: string) => Promise<boolean>;
  /** Removes the user from a tenant; resolves true on success. */
  onRemoveFromTenant?: (tenantId: string) => Promise<boolean>;
}

/**
 * Global-admin surface of the roles tab: the user's global Identity roles, plus
 * an independent per-tenant role editor for every tenant the user belongs to.
 * The tenant surface uses `TenantRoleTab` for the single active tenant instead.
 */
export function GlobalRolesPanel({
  availableRoles,
  selectedRoles,
  rolesChanged,
  saving,
  onToggleRole,
  onReset,
  onSave,
  showTenantRoles,
  memberships,
  onSaveTenantRole,
  onAddToTenant,
  onRemoveFromTenant,
}: Readonly<IGlobalRolesPanelProps>) {
  return (
    <div className="space-y-6">
      <GlobalRolesTab
        availableRoles={availableRoles}
        selectedRoles={selectedRoles}
        rolesChanged={rolesChanged}
        saving={saving}
        onToggleRole={onToggleRole}
        onReset={onReset}
        onSave={onSave}
      />
      {showTenantRoles && (
        <UserTenantRolesSection
          memberships={memberships}
          onSaveRole={onSaveTenantRole}
          onAddToTenant={onAddToTenant}
          onRemoveFromTenant={onRemoveFromTenant}
        />
      )}
    </div>
  );
}

export default GlobalRolesPanel;
