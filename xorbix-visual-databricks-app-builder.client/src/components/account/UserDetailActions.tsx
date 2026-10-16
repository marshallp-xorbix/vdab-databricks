import { Button } from "../ui/button";
import { AccountActionsSection } from "./AccountActionsSection";

interface IUserDetailActionsProps {
  /** Account-level actions (email, password, lock, deactivate) — self or global admin. */
  canEditAccount: boolean;
  /** Membership-level actions (remove, suspend/resume) on the tenant surface. */
  canManageMembership: boolean;
  canManageRoles: boolean;
  canDeleteUser: boolean;
  /** Whether the viewer may remove this member from the current tenant. */
  canRemoveFromTenant: boolean;
  /**
   * Whether this member is the tenant owner and the viewer may not act on them.
   * When true, the deactivate and remove-from-tenant actions are hidden.
   */
  ownerProtected?: boolean;
  emailConfirmed: boolean;
  isUserLockedOut: boolean;
  isActive: boolean;
  /** When set, the account is retired — show Restore and hide live-account actions. */
  isRetired?: boolean;
  /** True when the membership is Suspended (tenant surface). */
  isMembershipSuspended?: boolean;
  /** Whether the admin password-reset action is available (hidden in passwordless-only mode). */
  showResetPassword: boolean;
  onManageRoles: () => void;
  onChangeEmail: () => void;
  onResetPassword: () => void;
  onResendConfirmation: () => void;
  onForceLogout: () => void;
  onToggleLock: () => void;
  onToggleActive: () => void;
  onSoftDelete: () => void;
  onPurge: () => void;
  onRemoveFromTenant: () => void;
  onSuspendMembership?: () => void;
  onResumeMembership?: () => void;
}

/**
 * Permission-gated account action buttons for the user-detail dashboard.
 * Account actions require canEditAccount; membership actions require
 * canManageMembership so tenant admins cannot lock or deactivate accounts.
 */
export function UserDetailActions({
  canEditAccount,
  canManageMembership,
  canManageRoles,
  canDeleteUser,
  canRemoveFromTenant,
  ownerProtected = false,
  emailConfirmed,
  isUserLockedOut,
  isActive,
  isRetired = false,
  isMembershipSuspended = false,
  showResetPassword,
  onManageRoles,
  onChangeEmail,
  onResetPassword,
  onResendConfirmation,
  onForceLogout,
  onToggleLock,
  onToggleActive,
  onSoftDelete,
  onPurge,
  onRemoveFromTenant,
  onSuspendMembership,
  onResumeMembership,
}: Readonly<IUserDetailActionsProps>) {
  // The tenant owner cannot be deactivated or removed by a non-owner admin.
  const showDeactivate = !(ownerProtected && isActive);
  const showMembershipLifecycle =
    canManageMembership && !ownerProtected && !!onSuspendMembership && !!onResumeMembership;

  return (
    <AccountActionsSection title="Actions">
      {isRetired ? (
        <>
          {canEditAccount && (
            <Button onClick={onToggleActive} variant="default">
              Restore User
            </Button>
          )}
          {canDeleteUser && (
            <Button onClick={onPurge} variant="destructive">
              Delete User and All Data (GDPR)
            </Button>
          )}
        </>
      ) : (
        <>
          {canManageRoles && (
            <Button onClick={onManageRoles} variant="outline">
              Manage Roles
            </Button>
          )}
          {canEditAccount && (
            <>
              <Button onClick={onChangeEmail} variant="outline">
                Change Email
              </Button>
              {showResetPassword && (
                <Button onClick={onResetPassword} variant="outline">
                  Reset Password
                </Button>
              )}
              {!emailConfirmed && (
                <Button onClick={onResendConfirmation} variant="outline">
                  Resend Email Confirmation
                </Button>
              )}
              <Button onClick={onForceLogout} variant="outline">
                Force Logout All Devices
              </Button>
              <Button onClick={onToggleLock} variant="outline">
                {isUserLockedOut ? "Unlock" : "Lock"} Account
              </Button>
              {showDeactivate && (
                <Button
                  onClick={onToggleActive}
                  variant={isActive ? "destructive" : "default"}
                >
                  {isActive ? "Deactivate" : "Restore"} User
                </Button>
              )}
            </>
          )}
          {showMembershipLifecycle &&
            (isMembershipSuspended ? (
              <Button onClick={onResumeMembership} variant="outline">
                Resume Membership
              </Button>
            ) : (
              <Button onClick={onSuspendMembership} variant="outline">
                Suspend Membership
              </Button>
            ))}
          {canRemoveFromTenant && !ownerProtected && (
            <Button onClick={onRemoveFromTenant} variant="destructive">
              Remove User
            </Button>
          )}
          {canDeleteUser && (
            <>
              <Button onClick={onSoftDelete} variant="destructive">
                Delete User
              </Button>
              <Button onClick={onPurge} variant="destructive">
                Delete User and All Data (GDPR)
              </Button>
            </>
          )}
        </>
      )}
    </AccountActionsSection>
  );
}

export default UserDetailActions;
