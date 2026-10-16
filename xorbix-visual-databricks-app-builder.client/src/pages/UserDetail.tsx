import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  History,
  LayoutDashboard,
  Mail,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { useUserManagement } from "../hooks/useUserManagement";
import { Button } from "../components/ui/button";
import { Chip } from "../components/ui/chip";
import { toast } from "../components/ui/use-toast";
import AuditLogsGrid from "../components/audit/AuditLogsGrid";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { useRecentAuditActivity } from "../hooks/useAuditLogsQuery";
import {
  SECURITY_EVENT_ACTION_TYPES,
  type AuditScope,
} from "../types/auditLog";
import {
  TabContent,
  TabbedContentViewer,
  type TabbedContentItem,
} from "../components/TabbedContentViewer";
import { UserSessionsTab } from "../components/UserSessionsTab";
import { UserDetailInfoCard } from "../components/account/UserDetailInfoCard";
import { AccountSettingsSection } from "../components/account/AccountSettingsSection";
import { ChangeEmailDialog } from "../components/account/ChangeEmailDialog";
import { ConfirmActionDialog } from "../components/account/ConfirmActionDialog";
import TypeToConfirmDialog from "../components/account/TypeToConfirmDialog";
import SecurityEventsCard from "../components/account/SecurityEventsCard";
import { TenantRoleTab } from "../components/account/TenantRoleTab";
import { GlobalRolesPanel } from "../components/account/GlobalRolesPanel";
import { UserDetailActions } from "../components/account/UserDetailActions";
import { useIdentity } from "../context/IdentityContext";
import { tenantApi } from "../api/TenantApi";
import { invalidateSeatQueriesAfterMemberRemoval } from "../hooks/invalidateSeatQueriesAfterMemberRemoval";
import { useLogger } from "../logger/useLogger";
import type { AppLogger } from "../logger/useLogger";
import { useUserDetailPermissions } from "../hooks/useUserDetailPermissions";
import { useClientConfig } from "../hooks/useClientConfig";

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  action: (() => Promise<void>) | null;
};

function LoadingState() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"></div>
    </div>
  );
}

interface IErrorStateProps {
  message: string;
  backLabel: string;
  onBack: () => void;
}

function ErrorState({
  message,
  backLabel,
  onBack,
}: Readonly<IErrorStateProps>) {
  return (
    <div className="p-8">
      <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
        {message}
      </div>
      <Button onClick={onBack} className="mt-4">
        {backLabel}
      </Button>
    </div>
  );
}

interface IUserDetailFallbackProps {
  loading: boolean;
  errorMessage: string | null;
  backLabel: string;
  onBack: () => void;
}

function UserDetailFallback({
  loading,
  errorMessage,
  backLabel,
  onBack,
}: Readonly<IUserDetailFallbackProps>) {
  if (loading) {
    return <LoadingState />;
  }

  return (
    <ErrorState
      message={errorMessage ?? "User not found"}
      backLabel={backLabel}
      onBack={onBack}
    />
  );
}

async function saveRoleChanges(
  userId: string,
  selectedRoles: string[],
  currentRoles: string[],
  manageRoles: (
    requestUserId: string,
    request: { rolesToAdd?: string[]; rolesToRemove?: string[] },
  ) => Promise<boolean>,
  reloadUser: (requestUserId: string) => Promise<unknown>,
) {
  const rolesToAdd = selectedRoles.filter(
    (role) => !currentRoles.includes(role),
  );
  const rolesToRemove = currentRoles.filter(
    (role) => !selectedRoles.includes(role),
  );

  if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
    return;
  }

  const success = await manageRoles(userId, {
    rolesToAdd: rolesToAdd.length > 0 ? rolesToAdd : undefined,
    rolesToRemove: rolesToRemove.length > 0 ? rolesToRemove : undefined,
  });

  if (success) {
    await reloadUser(userId);
  }
}

async function saveTenantRoleChange(
  tenantId: string,
  userId: string,
  role: string,
  reloadUser: (requestUserId: string) => Promise<unknown>,
  logger: AppLogger,
): Promise<boolean> {
  try {
    await tenantApi.updateMemberRoleInTenant(tenantId, userId, role);
    toast({
      title: "Account role updated",
      description: `This user is now a ${role} in the selected account.`,
    });
    await reloadUser(userId);
    return true;
  } catch (err) {
    logger.UI.error("Failed to update account role:", err);
    toast({
      variant: "destructive",
      title: "Could not update account role",
      description:
        "You may not have permission to assign this role, or the user is no longer part of this account.",
    });
    return false;
  }
}

async function saveAddUserToTenant(
  tenantId: string,
  userId: string,
  role: string,
  reloadUser: (requestUserId: string) => Promise<unknown>,
  logger: AppLogger,
): Promise<boolean> {
  try {
    await tenantApi.addMemberToTenant(tenantId, userId, role);
    toast({
      title: "Added to account",
      description: `This user is now a ${role} in the selected account.`,
    });
    await reloadUser(userId);
    return true;
  } catch (err) {
    logger.UI.error("Failed to add user to account:", err);
    toast({
      variant: "destructive",
      title: "Could not add user to account",
      description:
        "The user may already belong to this account, or the tenant may be inactive.",
    });
    return false;
  }
}

async function saveRemoveUserFromTenant(
  tenantId: string,
  userId: string,
  reloadUser: (requestUserId: string) => Promise<unknown>,
  logger: AppLogger,
): Promise<boolean> {
  try {
    await tenantApi.removeMemberFromTenant(tenantId, userId);
    toast({
      title: "Removed from account",
      description: "This user no longer has access to the selected account.",
    });
    await reloadUser(userId);
    return true;
  } catch (err) {
    logger.UI.error("Failed to remove user from account:", err);
    toast({
      variant: "destructive",
      title: "Could not remove user from account",
      description:
        "You may not have permission to remove this member, or they may no longer belong to this account.",
    });
    return false;
  }
}

function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const resolvedUserId = userId ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logger = useLogger("UserDetail");
  const { user: currentUser } = useIdentity();
  const { passwordlessOnly, isConfigLoaded, membershipReinstatementDays } =
    useClientConfig();
  // Treat the mode as passwordless-only until the runtime config resolves so password actions and the
  // security toggles never flash before passwordless-only mode is known.
  const showPasswordActions = isConfigLoaded && !passwordlessOnly;
  const rolesPermissionsRef = useRef<HTMLDivElement | null>(null);
  const {
    user,
    userRoles,
    availableRoles,
    loading,
    saving,
    error,
    loadUser,
    loadAvailableRoles,
    updateUser,
    deactivateUser,
    reactivateUser,
    changeEmail,
    manageRoles,
    resendConfirmation,
    initiatePasswordReset,
    lockUser,
    unlockUser,
    forceLogoutAllDevices,
    updateUserSettings,
    softDeleteUser,
    purgeUserData,
  } = useUserManagement(true);

  // Tenant mode is entered from the seat-management area; global-admin mode from
  // the administration area. The route, not the role, determines the surface.
  // Owner-derived flags and the owner refresh come from the same hook, which
  // loads the current tenant internally while in tenant mode.
  const {
    isTenantMode,
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
  } = useUserDetailPermissions(resolvedUserId);
  const callerTenantId = currentUser?.tenantId ?? null;

  // Removing a member from the tenant is a tenant-mode action available for any
  // member other than yourself (tenant admins; the backend enforces hierarchy).
  const canRemoveFromTenant = canManageMembership && !isViewedUserOwner;

  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [tenantRoleLoading, setTenantRoleLoading] = useState(false);
  const [isMembershipSuspended, setIsMembershipSuspended] = useState(false);

  const loadTenantRole = useCallback(async () => {
    if (!isTenantMode || !resolvedUserId) return;
    setTenantRoleLoading(true);
    try {
      const response = await tenantApi.getMemberRole(resolvedUserId);
      setTenantRole(response.role);
      setIsMembershipSuspended(response.status === "Suspended");
    } catch (err) {
      logger.UI.error("Failed to load account role:", err);
      setTenantRole(null);
    } finally {
      setTenantRoleLoading(false);
    }
  }, [isTenantMode, resolvedUserId, logger]);

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "Confirm Action",
    description: "Are you sure you want to continue?",
    action: null,
  });

  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgePending, setPurgePending] = useState(false);
  const [activeTabId, setActiveTabId] = useState("dashboard");
  const [pendingRolesScroll, setPendingRolesScroll] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const [passwordResetEmailSent, setPasswordResetEmailSent] = useState(false);

  // In tenant mode, audit activity must be scoped to the caller's tenant so the
  // backend authorizes a tenant admin viewing another member. In global mode the
  // user scope alone is sufficient (global admins see all of a user's activity).
  const activityScope: AuditScope =
    isTenantMode && callerTenantId
      ? {
          kind: "user",
          userId: resolvedUserId ?? "",
          tenantId: callerTenantId,
        }
      : { kind: "user", userId: resolvedUserId ?? "" };

  const {
    items: securityEvents,
    isLoading: securityEventsLoading,
    isError: securityEventsError,
    refetch: refetchSecurityEvents,
  } = useRecentAuditActivity({
    scope: activityScope,
    filters: { actionTypes: SECURITY_EVENT_ACTION_TYPES },
    take: 5,
    enabled: !!resolvedUserId,
  });

  useEffect(() => {
    if (resolvedUserId) {
      loadUser(resolvedUserId);
      loadAvailableRoles();
      loadTenantRole();
      setPasswordResetEmailSent(false);
    }
  }, [resolvedUserId, loadUser, loadAvailableRoles, loadTenantRole]);

  useEffect(() => {
    setSelectedRoles(userRoles);
  }, [userRoles]);

  useEffect(() => {
    if (!pendingRolesScroll || activeTabId !== "roles-permissions") {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      rolesPermissionsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingRolesScroll(false);
    }, 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [activeTabId, pendingRolesScroll]);

  const runAction = useCallback(
    async (action: () => Promise<boolean>) => {
      const success = await action();
      if (success && resolvedUserId) await loadUser(resolvedUserId);
    },
    [loadUser, resolvedUserId],
  );

  const confirm = useCallback(
    (title: string, description: string, action: () => Promise<boolean>) => {
      setConfirmState({
        open: true,
        title,
        description,
        action: async () => {
          const success = await action();
          if (success && resolvedUserId) await loadUser(resolvedUserId);
        },
      });
    },
    [loadUser, resolvedUserId],
  );

  const handleConfirmAction = async () => {
    const action = confirmState.action;
    setConfirmState((prev) => ({ ...prev, open: false, action: null }));
    await action?.();
  };

  const handleChangeEmail = async (newEmail: string) => {
    if (!resolvedUserId) return;
    const success = await changeEmail(resolvedUserId, newEmail);
    if (success) {
      setChangeEmailOpen(false);
      await loadUser(resolvedUserId);
    }
  };

  const handleSaveRoles = async () => {
    if (!resolvedUserId) return;

    setSavingRoles(true);
    try {
      await saveRoleChanges(
        resolvedUserId,
        selectedRoles,
        userRoles,
        manageRoles,
        loadUser,
      );
    } finally {
      setSavingRoles(false);
    }
  };

  const goToRolesPermissions = useCallback(() => {
    setActiveTabId("roles-permissions");
    setPendingRolesScroll(true);
  }, []);

  const handleResendConfirmation = () =>
    runAction(() => resendConfirmation(resolvedUserId!));

  const handleInitiatePasswordReset = () =>
    confirm(
      "Initiate Password Reset",
      "Are you sure you want to initiate a password reset for this user?",
      async () => {
        const success = await initiatePasswordReset(resolvedUserId!);
        if (success) {
          setPasswordResetEmailSent(true);
        }
        return success;
      },
    );

  const handleLockUser = () =>
    confirm(
      "Lock Account",
      "Are you sure you want to lock this user account?",
      () => lockUser(resolvedUserId!),
    );

  const handleUnlockUser = () => runAction(() => unlockUser(resolvedUserId!));

  const handleForceLogout = () =>
    confirm(
      "Force Logout",
      "Are you sure you want to force logout on all devices? This will invalidate all sessions.",
      () => forceLogoutAllDevices(resolvedUserId!),
    );

  const handleDeactivateUser = () =>
    confirm(
      "Deactivate User",
      "Are you sure you want to deactivate this user? They will not be able to log in.",
      () => deactivateUser(resolvedUserId!),
    );

  const handleReactivateUser = () =>
    runAction(() => reactivateUser(resolvedUserId!));

  const handleSuspendMembership = () => {
    if (!user || !resolvedUserId) return;
    const memberName = user.fullName || user.userName || user.email;
    setConfirmState({
      open: true,
      title: "Suspend Membership",
      description: `${memberName} will lose access to this workspace until you resume their membership. Their VDAB account is unaffected.`,
      confirmLabel: "Suspend",
      action: async () => {
        try {
          const updated = await tenantApi.suspendMember(resolvedUserId);
          setIsMembershipSuspended(updated.status === "Suspended");
          await invalidateSeatQueriesAfterMemberRemoval(queryClient);
          toast({
            title: "Membership suspended",
            description: `${memberName} can no longer access this workspace.`,
          });
        } catch (err) {
          logger.UI.error("Failed to suspend membership:", err);
          await invalidateSeatQueriesAfterMemberRemoval(queryClient);
          toast({
            variant: "destructive",
            title: "Could not suspend membership",
            description:
              "You may not have permission, or the member is no longer part of your account.",
          });
        }
      },
    });
  };

  const handleResumeMembership = () => {
    if (!user || !resolvedUserId) return;
    const memberName = user.fullName || user.userName || user.email;
    void (async () => {
      try {
        const updated = await tenantApi.resumeMember(resolvedUserId);
        setIsMembershipSuspended(updated.status === "Suspended");
        await invalidateSeatQueriesAfterMemberRemoval(queryClient);
        toast({
          title: "Membership resumed",
          description: `${memberName} can access this workspace again.`,
        });
      } catch (err) {
        logger.UI.error("Failed to resume membership:", err);
        await invalidateSeatQueriesAfterMemberRemoval(queryClient);
        toast({
          variant: "destructive",
          title: "Could not resume membership",
          description:
            "You may not have permission, or the member is no longer part of your account.",
        });
      }
    })();
  };

  const handleRemoveFromTenant = () => {
    if (!user) return;

    const memberName = user.fullName || user.userName || user.email;
    const confirmLabel = "Remove User";
    const description = `Remove ${memberName} from this workspace? They lose access immediately and their seat is released. Their VDAB account and any other organizations are unaffected. You can restore their membership for ${membershipReinstatementDays} days.`;

    setConfirmState({
      open: true,
      title: "Remove User from Account",
      description,
      confirmLabel,
      action: async () => {
        if (!resolvedUserId) return;
        try {
          await tenantApi.removeMember(resolvedUserId);
          await invalidateSeatQueriesAfterMemberRemoval(queryClient);
          toast({
            title: "User removed",
            description: `${memberName} was removed from your account.`,
          });
          navigate(backTo);
        } catch (err) {
          logger.UI.error("Failed to remove member from account:", err);
          await invalidateSeatQueriesAfterMemberRemoval(queryClient);
          toast({
            variant: "destructive",
            title: "Could not remove user",
            description:
              "You may not have permission to remove this member, or they may no longer be part of your account.",
          });
        }
      },
    });
  };

  const handleTransferOwnership = () => {
    if (!user) return;

    const memberName = user.fullName || user.userName || user.email;
    const callerImpact = isCurrentUserOwner
      ? "You keep your current role but will no longer be the owner. Only the new owner can transfer ownership again."
      : "The current owner keeps their role but will no longer be the owner.";

    setConfirmState({
      open: true,
      title: "Transfer Account Ownership",
      description: `${memberName} will become the account owner and be promoted to Admin if they aren't already. ${callerImpact}`,
      confirmLabel: "Transfer Ownership",
      action: async () => {
        if (!resolvedUserId) return;
        try {
          await tenantApi.transferOwnership(resolvedUserId);
          toast({
            title: "Ownership transferred",
            description: `${memberName} is now the account owner.`,
          });
          await Promise.all([refreshOwner(), loadTenantRole()]);
          await loadUser(resolvedUserId);
        } catch (err) {
          logger.UI.error("Failed to transfer ownership:", err);
          toast({
            variant: "destructive",
            title: "Could not transfer ownership",
            description:
              "You may not have permission, or the member is no longer part of your account.",
          });
        }
      },
    });
  };

  const handleSoftDeleteUser = () =>
    confirm(
      "Delete User",
      "This retires the account and removes them from all workspaces. Their email is freed for a new registration; the tombstone is kept for audit and may be restored by a platform admin.",
      async () => {
        const success = await softDeleteUser(resolvedUserId!);
        if (success) navigate(backTo);
        return success;
      },
    );

  const handlePurgeUserData = () => {
    setPurgeDialogOpen(true);
  };

  const handleConfirmPurgeUserData = async () => {
    if (!resolvedUserId) {
      return;
    }

    setPurgePending(true);
    try {
      const success = await purgeUserData(resolvedUserId);
      if (success) {
        setPurgeDialogOpen(false);
        navigate(backTo);
      }
    } finally {
      setPurgePending(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  if (loading || error || !user) {
    return (
      <UserDetailFallback
        loading={loading}
        errorMessage={error}
        backLabel={backLabel}
        onBack={() => navigate(backTo)}
      />
    );
  }

  const primaryRole = isTenantMode
    ? (tenantRole ?? "No account role")
    : userRoles[0] || "No role assigned";
  const formattedLastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString()
    : "Never";
  const lockoutEndDate = user.lockoutEnd ? new Date(user.lockoutEnd) : null;
  const isUserLockedOut =
    !!lockoutEndDate &&
    !Number.isNaN(lockoutEndDate.getTime()) &&
    lockoutEndDate.getTime() > Date.now();
  const rolesChanged =
    selectedRoles.length !== userRoles.length ||
    selectedRoles.some((role) => !userRoles.includes(role));

  const tabbedContentItems: TabbedContentItem[] = [
    {
      id: "dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "sessions",
      label: "Sessions",
      icon: Monitor,
    },
    {
      id: "roles-permissions",
      label: "Roles & Permissions",
      icon: ShieldCheck,
    },
    {
      id: "activity-log",
      label: "Activity Log",
      icon: History,
    },
  ];

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ManagementPageHeader
          id="user-detail-header"
          content={
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-bold text-primary shadow-sm">
                {`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` ||
                  user.email.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-foreground">
                    {user.fullName || user.userName}
                  </h2>
                  <Chip
                    variant={
                      user.deletedOn
                        ? "destructive"
                        : user.isActive
                          ? "success"
                          : "destructive"
                    }
                  >
                    {user.deletedOn
                      ? "Removed"
                      : user.isActive
                        ? "Active"
                        : "Inactive"}
                  </Chip>
                  {isUserLockedOut && <Chip variant="destructive">Locked</Chip>}
                </div>
                <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>
                  <div className="hidden h-1 w-1 rounded-full bg-muted sm:block"></div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    {primaryRole}
                    {isViewedUserOwner ? " / Account Owner" : ""}
                  </div>
                </div>
              </div>
            </div>
          }
          actions={
            <div className="flex w-full items-center gap-3 md:w-auto">
              {canEditAccount && showPasswordActions && !user.deletedOn && (
                <Button variant="outline" onClick={handleInitiatePasswordReset}>
                  Reset Password
                </Button>
              )}
              {passwordResetEmailSent && (
                <span className="text-xs font-medium text-success-foreground">
                  Reset email sent
                </span>
              )}
            </div>
          }
        />

        <TabbedContentViewer
          id="user-tabs"
          tabs={tabbedContentItems}
          defaultTabId="dashboard"
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
        >
          <TabContent id="dashboard">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {isTenantMode && !canEditAccount && (
                  <div className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
                    You can manage this member&apos;s role and membership in your
                    workspace. Their VDAB account settings can only be changed by
                    the user or a platform administrator.
                  </div>
                )}

                <UserDetailInfoCard
                  isAdmin={canEditAccount}
                  canEdit={canEditAccount}
                  user={user}
                  saving={saving}
                  onSave={async (data) => {
                    const success = await updateUser(resolvedUserId!, data);
                    if (success) await loadUser(resolvedUserId!);
                  }}
                />

                {canEditAccount && (
                  <AccountSettingsSection
                    user={user}
                    saving={saving}
                    hideSecurityToggles={!showPasswordActions}
                    onSettingsChange={(settings) =>
                      resolvedUserId &&
                      updateUserSettings(resolvedUserId, settings)
                    }
                  />
                )}

                <UserDetailActions
                  canEditAccount={canEditAccount}
                  canManageMembership={canManageMembership}
                  canManageRoles={
                    !isViewedUserOwner &&
                    (canManageGlobalRoles || canManageTenantRole)
                  }
                  canDeleteUser={canDeleteUser}
                  canRemoveFromTenant={canRemoveFromTenant}
                  ownerProtected={ownerProtected}
                  emailConfirmed={user.emailConfirmed}
                  isUserLockedOut={isUserLockedOut}
                  isActive={user.isActive}
                  isRetired={!!user.deletedOn}
                  isMembershipSuspended={isMembershipSuspended}
                  showResetPassword={showPasswordActions}
                  onManageRoles={goToRolesPermissions}
                  onChangeEmail={() => setChangeEmailOpen(true)}
                  onResetPassword={handleInitiatePasswordReset}
                  onResendConfirmation={handleResendConfirmation}
                  onForceLogout={handleForceLogout}
                  onToggleLock={
                    isUserLockedOut ? handleUnlockUser : handleLockUser
                  }
                  onToggleActive={
                    user.deletedOn || !user.isActive
                      ? handleReactivateUser
                      : handleDeactivateUser
                  }
                  onSoftDelete={handleSoftDeleteUser}
                  onPurge={handlePurgeUserData}
                  onRemoveFromTenant={handleRemoveFromTenant}
                  onSuspendMembership={handleSuspendMembership}
                  onResumeMembership={handleResumeMembership}
                />
              </div>

              <div className="space-y-6 lg:col-span-1">
                <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between bg-muted">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
                      Primary Role
                    </CardTitle>
                    <Button
                      title="Edit roles"
                      variant="ghost"
                      size="icon"
                      onClick={goToRolesPermissions}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="text-lg font-bold text-foreground">
                      {primaryRole}
                      {isViewedUserOwner ? " / Account Owner" : ""}
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Role and permissions summary.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-border bg-card shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between bg-muted">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
                      Session Info
                    </CardTitle>
                    <Button
                      title="View all sessions"
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveTabId("sessions")}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-3">
                      <Monitor className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Browser Session
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last known access for this account.
                        </p>
                        <p className="mt-1 text-xs font-medium text-success">
                          {formattedLastLogin === "Never"
                            ? "No recent session"
                            : "Recently Active"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last seen: {formattedLastLogin}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <SecurityEventsCard
                  events={securityEvents}
                  loading={securityEventsLoading}
                  isError={securityEventsError}
                  onRetry={() => {
                    void refetchSecurityEvents();
                  }}
                  onViewAll={() => setActiveTabId("activity-log")}
                />
              </div>
            </div>
          </TabContent>

          <TabContent id="sessions">
            {resolvedUserId && <UserSessionsTab userId={resolvedUserId} />}
          </TabContent>

          <TabContent id="roles-permissions">
            <div ref={rolesPermissionsRef}>
              {isTenantMode ? (
                <TenantRoleTab
                  userId={resolvedUserId!}
                  currentRole={tenantRole}
                  loading={tenantRoleLoading}
                  canManage={canManageTenantRole}
                  isOwner={isViewedUserOwner}
                  isSelf={resolvedUserId === currentUser?.userId}
                  ownerLocked={ownerProtected}
                  canTransferOwnership={
                    canTransferOwnership && !isViewedUserOwner
                  }
                  isViewerOwner={isCurrentUserOwner}
                  onTransferOwnership={handleTransferOwnership}
                  onRoleUpdated={setTenantRole}
                />
              ) : (
                <GlobalRolesPanel
                  availableRoles={availableRoles}
                  selectedRoles={selectedRoles}
                  rolesChanged={rolesChanged}
                  saving={savingRoles}
                  onToggleRole={toggleRole}
                  onReset={() => setSelectedRoles(userRoles)}
                  onSave={handleSaveRoles}
                  showTenantRoles={canManageAllTenantRoles}
                  memberships={user.tenantMembershipsSummary}
                  onSaveTenantRole={(tenantId, role) =>
                    saveTenantRoleChange(
                      tenantId,
                      resolvedUserId!,
                      role,
                      loadUser,
                      logger,
                    )
                  }
                  onAddToTenant={(tenantId, role) =>
                    saveAddUserToTenant(
                      tenantId,
                      resolvedUserId!,
                      role,
                      loadUser,
                      logger,
                    )
                  }
                  onRemoveFromTenant={
                    resolvedUserId === currentUser?.userId
                      ? undefined
                      : (tenantId) =>
                          saveRemoveUserFromTenant(
                            tenantId,
                            resolvedUserId!,
                            loadUser,
                            logger,
                          )
                  }
                />
              )}
            </div>
          </TabContent>

          <TabContent id="activity-log">
            {resolvedUserId && <AuditLogsGrid scope={activityScope} />}
          </TabContent>
        </TabbedContentViewer>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(backTo)}>
            {backLabel}
          </Button>
        </div>
      </div>

      <ChangeEmailDialog
        open={changeEmailOpen}
        onOpenChange={setChangeEmailOpen}
        mode="admin"
        saving={saving}
        onSubmit={handleChangeEmail}
      />

      <ConfirmActionDialog
        open={confirmState.open}
        onOpenChange={(open) =>
          setConfirmState((prev) => ({
            ...prev,
            open,
            action: open ? prev.action : null,
          }))
        }
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={handleConfirmAction}
      />

      <TypeToConfirmDialog
        open={purgeDialogOpen}
        onOpenChange={setPurgeDialogOpen}
        title="Delete User and All Data (GDPR)?"
        description="Permanently delete this user and all related data (owned apps, Databricks connections, memberships, preferences, seats, tokens, and AI usage). This cannot be undone and is intended for GDPR compliance."
        confirmationPhrase={user.email}
        confirmLabel="Delete User and All Data (GDPR)"
        isPending={purgePending}
        onConfirm={handleConfirmPurgeUserData}
      />
    </section>
  );
}

export default UserDetail;
