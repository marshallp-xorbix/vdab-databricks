import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "../ui/use-toast";
import { tenantApi } from "../../api/TenantApi";
import { TenantRoleSlug } from "../../types/tenantRole";
import { useLogger } from "../../logger/useLogger";

/**
 * Assignable tenant membership roles. The global `Administrator` role is
 * intentionally excluded — it is a cross-tenant Identity role, not a tenant
 * membership role, and cannot be granted from a tenant-scoped view.
 */
const ASSIGNABLE_TENANT_ROLES: readonly string[] = [
  TenantRoleSlug.Admin,
  TenantRoleSlug.Developer,
];

interface ITenantRoleTabProps {
  userId: string;
  currentRole: string | null;
  loading: boolean;
  /** Whether the viewer may change this member's tenant role. */
  canManage: boolean;
  /** Whether this member is the current tenant owner. */
  isOwner?: boolean;
  /** Whether the member being viewed is the currently logged-in user. */
  isSelf?: boolean;
  /** Whether role changes are locked because this member is the owner-protected user. */
  ownerLocked?: boolean;
  /** Whether the viewer may transfer ownership to this member. */
  canTransferOwnership?: boolean;
  /** Whether the logged-in viewer is the current tenant owner. */
  isViewerOwner?: boolean;
  /** Invoked to transfer tenant ownership to this member. */
  onTransferOwnership?: () => void;
  /** Invoked with the new role after a successful update. */
  onRoleUpdated: (role: string) => void;
}

/**
 * Tenant-scoped role management for a single member. Replaces the global
 * Identity-role editor when the user detail page is viewed in tenant context.
 * Edits the member's `UserTenantMembership.Role` via the tenant member-role
 * endpoints, which are scoped server-side to the caller's active tenant.
 */
export function TenantRoleTab({
  userId,
  currentRole,
  loading,
  canManage,
  isOwner = false,
  isSelf = false,
  ownerLocked = false,
  canTransferOwnership = false,
  isViewerOwner = false,
  onTransferOwnership,
  onRoleUpdated,
}: Readonly<ITenantRoleTabProps>) {
  const logger = useLogger("TenantRoleTab");
  const [selectedRole, setSelectedRole] = useState<string>(currentRole ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedRole(currentRole ?? "");
  }, [currentRole]);

  const ownerViewingSelf = isOwner && isSelf;
  const roleChanged = selectedRole !== "" && selectedRole !== currentRole;
  const canChangeRole = canManage && !ownerLocked && !ownerViewingSelf;

  const handleSave = async () => {
    if (!roleChanged) return;

    setSaving(true);
    try {
      const response = await tenantApi.updateMemberRole(userId, selectedRole);
      onRoleUpdated(response.role);
      toast({
        title: "Account role updated",
        description: `This member is now a ${response.role} in your account.`,
      });
    } catch (err) {
      logger.UI.error("Failed to update account role:", err);
      toast({
        variant: "destructive",
        title: "Could not update account role",
        description:
          "You may not have permission to assign this role, or the member is not part of your account.",
      });
      setSelectedRole(currentRole ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-3">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground">
              Account Role
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Controls what this member can do within your account. This is
              separate from any global platform roles.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading account role…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Current role</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {currentRole ?? "No account role"}
                    </span>
                    {isOwner && (
                      <span className="inline-flex rounded-full border border-warning/30 bg-warning-subtle px-3 py-1 text-xs font-medium text-warning-foreground">
                        Account Owner
                      </span>
                    )}
                  </div>
                </div>

                {ownerViewingSelf && (
                  <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                    To change your role, you must first transfer ownership to
                    another member.
                  </p>
                )}

                {ownerLocked && (
                  <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                    Only the account owner can change the owner's role.
                  </p>
                )}

                <div className="space-y-3 border-t border-border pt-4">
                  <span className="text-sm font-medium text-foreground">
                    Change role
                  </span>
                  <Select
                    value={selectedRole}
                    onValueChange={setSelectedRole}
                    disabled={saving || !canChangeRole}
                  >
                    <SelectTrigger className="w-full sm:w-72">
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

                  <div className="flex justify-end gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedRole(currentRole ?? "")}
                      disabled={!roleChanged || saving || !canChangeRole}
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={!roleChanged || saving || !canChangeRole}
                      className="bg-primary text-primary-foreground hover:bg-primary-hover"
                    >
                      {saving ? "Saving…" : "Save Role"}
                    </Button>
                  </div>
                </div>

                {canTransferOwnership && !isOwner && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <span className="text-sm font-medium text-foreground">
                      Account ownership
                    </span>
                    <p className="text-sm text-muted-foreground">
                      Make this member the account owner. They will be promoted
                      to Admin if needed, and{" "}
                      {isViewerOwner
                        ? "you will no longer be the owner."
                        : "the current owner will no longer be the owner."}
                    </p>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={onTransferOwnership}>
                        Make Owner
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TenantRoleTab;
