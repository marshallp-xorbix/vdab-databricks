import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import TenantPickerCombobox from "./TenantPickerCombobox";
import { UserTenantRoleRow } from "./UserTenantRoleRow";
import { useTenantManagement } from "../../hooks/useTenantManagement";
import { TenantRoleSlug } from "../../types/tenantRole";
import type { IUserTenantMembershipDto } from "../../models/UserTenantMembershipDto";

const ASSIGNABLE_TENANT_ROLES: readonly string[] = [
  TenantRoleSlug.Admin,
  TenantRoleSlug.Developer,
];

interface IUserTenantRolesSectionProps {
  /** Every tenant the viewed user belongs to, with their role in each. */
  memberships: IUserTenantMembershipDto[];
  /**
   * Saves a new role for the user within the given tenant. Returns `true` when
   * the update succeeds so each row can reflect the persisted role.
   */
  onSaveRole: (tenantId: string, role: string) => Promise<boolean>;
  /**
   * Adds the user to a tenant they do not already belong to. Returns `true`
   * when the membership is created.
   */
  onAddToTenant: (tenantId: string, role: string) => Promise<boolean>;
  /**
   * Removes the user from a tenant. Returns `true` when the membership is
   * revoked. Omitted when the viewer may not remove access (e.g. self).
   */
  onRemoveFromTenant?: (tenantId: string) => Promise<boolean>;
}

/**
 * Per-tenant role editor shown on the global-admin surface of the user-detail
 * page. Lists every tenant the viewed user belongs to and lets an administrator
 * change the user's role in each tenant independently. Also supports adding the
 * user to another account. Tenant-scoped role management for a single tenant
 * uses `TenantRoleTab` instead.
 */
export function UserTenantRolesSection({
  memberships,
  onSaveRole,
  onAddToTenant,
  onRemoveFromTenant,
}: Readonly<IUserTenantRolesSectionProps>) {
  const { tenants, isLoading: tenantsLoading } = useTenantManagement();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>(
    TenantRoleSlug.Developer,
  );
  const [adding, setAdding] = useState(false);
  const [membershipPendingRemoval, setMembershipPendingRemoval] =
    useState<IUserTenantMembershipDto | null>(null);
  const [removing, setRemoving] = useState(false);

  const memberTenantIds = useMemo(
    () => new Set(memberships.map((membership) => membership.tenantId)),
    [memberships],
  );

  const availableTenants = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          tenant.isActive && !memberTenantIds.has(tenant.tenantId),
      ),
    [tenants, memberTenantIds],
  );

  const handleAdd = async () => {
    if (!selectedTenantId) return;

    setAdding(true);
    try {
      const success = await onAddToTenant(selectedTenantId, selectedRole);
      if (success) {
        setSelectedTenantId("");
        setSelectedRole(TenantRoleSlug.Developer);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!membershipPendingRemoval || !onRemoveFromTenant) return;

    setRemoving(true);
    try {
      const success = await onRemoveFromTenant(
        membershipPendingRemoval.tenantId,
      );
      if (success) {
        setMembershipPendingRemoval(null);
      }
    } finally {
      setRemoving(false);
    }
  };

  const removeDialogOpen = membershipPendingRemoval !== null;
  const removeDescription = membershipPendingRemoval
    ? membershipPendingRemoval.isOwner
      ? `Remove access to "${membershipPendingRemoval.tenantDisplayName}" (${membershipPendingRemoval.tenantId})? This user owns the account; ownership will transfer to another membership when available, or the home tenant will be cleared.`
      : `Remove access to "${membershipPendingRemoval.tenantDisplayName}" (${membershipPendingRemoval.tenantId})? Their seat will be freed if occupied. Payment and subscription tier are unchanged.`
    : "";

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border bg-muted/50">
        <CardTitle className="text-base font-semibold text-foreground">
          Account Roles
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage this user&apos;s role within each account they belong to. These
          roles are separate from the global platform roles above.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {memberships.length > 0 ? (
          memberships.map((membership) => (
            <UserTenantRoleRow
              key={membership.tenantId}
              membership={membership}
              onSaveRole={onSaveRole}
              onRequestRemove={
                onRemoveFromTenant
                  ? setMembershipPendingRemoval
                  : undefined
              }
              removing={
                removing &&
                membershipPendingRemoval?.tenantId === membership.tenantId
              }
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            This user does not belong to any accounts.
          </p>
        )}

        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Add to account</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Place this user into a tenant without changing payment or
            subscription tier.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="add-tenant" className="text-xs text-muted-foreground">
                Select a tenant
              </Label>
              <TenantPickerCombobox
                id="add-tenant"
                options={availableTenants}
                value={selectedTenantId}
                onChange={setSelectedTenantId}
                disabled={tenantsLoading || adding}
                placeholder={
                  tenantsLoading ? "Loading tenants…" : "Select a tenant"
                }
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <Label htmlFor="add-role" className="text-xs text-muted-foreground">
                Role
              </Label>
              <Select
                value={selectedRole}
                onValueChange={setSelectedRole}
                disabled={adding}
              >
                <SelectTrigger id="add-role">
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
            </div>
            <Button
              onClick={handleAdd}
              disabled={!selectedTenantId || adding}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {adding ? "Adding…" : "Add to account"}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmActionDialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          if (!open && !removing) {
            setMembershipPendingRemoval(null);
          }
        }}
        title="Remove account access"
        description={removeDescription}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRemove}
      />
    </Card>
  );
}

export default UserTenantRolesSection;
