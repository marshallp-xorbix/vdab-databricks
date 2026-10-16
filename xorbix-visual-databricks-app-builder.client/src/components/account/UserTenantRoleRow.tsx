import { useState } from "react";
import { Building2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { TenantRoleSlug } from "../../types/tenantRole";
import type { IUserTenantMembershipDto } from "../../models/UserTenantMembershipDto";

/**
 * Assignable tenant membership roles. The global `Administrator` role is
 * intentionally excluded — it is a cross-tenant Identity role, not a tenant
 * membership role, and cannot be granted from a tenant-scoped view.
 */
const ASSIGNABLE_TENANT_ROLES: readonly string[] = [
  TenantRoleSlug.Admin,
  TenantRoleSlug.Developer,
];

interface IUserTenantRoleRowProps {
  /** The viewed user's membership in a single tenant. */
  membership: IUserTenantMembershipDto;
  /**
   * Saves a new role for the user within this tenant. Returns `true` when the
   * update succeeds so the row keeps the persisted role on success and reverts
   * the selection on failure.
   */
  onSaveRole: (tenantId: string, role: string) => Promise<boolean>;
  /**
   * Opens the remove-from-account confirmation for this membership. Omitted when
   * removal is not allowed (for example when viewing your own user record).
   */
  onRequestRemove?: (membership: IUserTenantMembershipDto) => void;
  /** Whether a remove confirmation is currently in flight for this row. */
  removing?: boolean;
}

/**
 * A single tenant row within {@link UserTenantRolesSection}. Lets an
 * administrator change the user's role in one tenant. When the user owns the
 * tenant, role editing is locked and an explanatory note is shown instead.
 */
export function UserTenantRoleRow({
  membership,
  onSaveRole,
  onRequestRemove,
  removing = false,
}: Readonly<IUserTenantRoleRowProps>) {
  const [selectedRole, setSelectedRole] = useState<string>(membership.role);
  const [saving, setSaving] = useState(false);

  const roleChanged = selectedRole !== "" && selectedRole !== membership.role;
  const tenantLabel = `${membership.tenantDisplayName} - ${membership.tenantId}`;

  const handleSave = async () => {
    if (!roleChanged) return;

    setSaving(true);
    try {
      const success = await onSaveRole(membership.tenantId, selectedRole);
      if (!success) {
        setSelectedRole(membership.role);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground" title={tenantLabel}>
            {tenantLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {membership.isOwner && (
            <span className="inline-flex rounded-full border border-warning/30 bg-warning-subtle px-3 py-1 text-xs font-medium text-warning-foreground">
              Account Owner
            </span>
          )}
          {membership.isPrimary && (
            <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Home Account
            </span>
          )}
          <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {membership.role}
          </span>
          {onRequestRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Remove access to ${membership.tenantDisplayName}`}
              disabled={removing}
              onClick={() => onRequestRemove(membership)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {membership.isOwner ? (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          This user owns this account. Transfer ownership before changing their
          role. Removing access still frees their seat and revokes membership.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
          <Select
            value={selectedRole}
            onValueChange={setSelectedRole}
            disabled={saving || removing}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_TENANT_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedRole(membership.role)}
              disabled={!roleChanged || saving || removing}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!roleChanged || saving || removing}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {saving ? "Saving…" : "Save Role"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserTenantRoleRow;
