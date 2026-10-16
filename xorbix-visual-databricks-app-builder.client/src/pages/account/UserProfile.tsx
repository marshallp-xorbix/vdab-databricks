import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useIdentity } from "../../context/IdentityContext";
import { useClientConfig } from "../../hooks/useClientConfig";
import { useCurrentTenant } from "../../hooks/useCurrentTenant";
import { normalizeTier } from "../../hooks/useSubscription";
import { UserDetailInfoCard } from "../../components/account/UserDetailInfoCard";
import { AccountActionsSection } from "../../components/account/AccountActionsSection";
import { ChangeEmailDialog } from "../../components/account/ChangeEmailDialog";
import {
  ChangePasswordDialog,
  type ChangePasswordValues,
} from "../../components/account/ChangePasswordDialog";
import { ConfirmActionDialog } from "../../components/account/ConfirmActionDialog";
import { identityApi } from "../../providers/IdentityApi";
import type { IUserProfileResponse } from "../../models";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/use-toast";
import { parseError } from "../../lib/utils";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import { canManageTenantSeats } from "../../types/tenantRole";
import { isGlobalAdministrator } from "../../utils/roles";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

function UserProfile() {
  const { user: identityUser, logoutAll, clearLocalSession } = useIdentity();
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();
  const { tenant, isLoading: tenantLoading } = useCurrentTenant(
    !!identityUser?.tenantId,
  );
  // Default password actions to hidden until the runtime config resolves so they never flash on a hard
  // refresh/deep-link before passwordless-only mode is known.
  const showPasswordActions = isConfigLoaded && !passwordlessOnly;
  const [user, setUser] = useState<IUserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [forceLogoutDialogOpen, setForceLogoutDialogOpen] = useState(false);

  const canSelfChangeEmail = useMemo(() => {
    const isGlobalAdmin = isGlobalAdministrator(identityUser);
    const isTenantAdmin = canManageTenantSeats(identityUser?.tenantRole);

    if (isGlobalAdmin || isTenantAdmin) {
      return true;
    }

    if (tenantLoading) {
      return false;
    }

    const tier = normalizeTier(tenant?.subscriptionTier);
    return (
      tier !== SubscriptionTierSlug.Team &&
      tier !== SubscriptionTierSlug.Enterprise
    );
  }, [identityUser, tenant?.subscriptionTier, tenantLoading]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await identityApi.getCurrentUser();
        setUser(profile);
      } catch {
        toast({ title: "Failed to load profile", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSaveBasicInfo(data: {
    firstName: string;
    lastName: string;
  }) {
    setSaving(true);
    try {
      await identityApi.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
      });
      const profile = await identityApi.getCurrentUser();
      setUser(profile);
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEmail(newEmail: string, currentPassword?: string) {
    setSaving(true);
    try {
      await identityApi.changeEmail({ newEmail, currentPassword });
      setEmailDialogOpen(false);
      toast({
        title: "Email change initiated",
        description: "Check your email to confirm the change.",
      });
    } catch (error) {
      toast({
        title: "Failed to initiate email change",
        description: parseError(error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(values: ChangePasswordValues) {
    if (values.newPassword !== values.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await identityApi.changePassword(values);
      setPasswordDialogOpen(false);
      toast({
        title: "Password changed",
        description: "Please sign in with your new password.",
      });
      clearLocalSession({ redirectTo: "/login" });
    } catch {
      toast({ title: "Failed to change password", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleForceLogout() {
    setForceLogoutDialogOpen(false);
    await logoutAll({ redirectTo: "/" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Profile</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            Manage your personal information, security, and preferences.
          </p>
        </header>

        <UserDetailInfoCard
          isAdmin={false}
          user={user}
          saving={saving}
          onSave={handleSaveBasicInfo}
        />

        <AccountActionsSection layout="flex">
          {canSelfChangeEmail && (
            <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
              Change Email
            </Button>
          )}
          {showPasswordActions && (
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(true)}
            >
              Change Password
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setForceLogoutDialogOpen(true)}
          >
            Force Logout All Devices
          </Button>
        </AccountActionsSection>
      </div>

      <ChangeEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        mode="self"
        currentEmail={identityUser?.email}
        saving={saving}
        requireCurrentPassword={isConfigLoaded && !passwordlessOnly}
        onSubmit={handleChangeEmail}
      />

      {showPasswordActions && (
        <ChangePasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          saving={saving}
          onSubmit={handleChangePassword}
        />
      )}

      <ConfirmActionDialog
        open={forceLogoutDialogOpen}
        onOpenChange={setForceLogoutDialogOpen}
        title="Force Logout All Devices"
        description="This will sign you out of all devices, including this one. You will need to sign in again to continue."
        confirmLabel="Sign Out Everywhere"
        onConfirm={handleForceLogout}
      />
    </section>
  );
}

export default UserProfile;
