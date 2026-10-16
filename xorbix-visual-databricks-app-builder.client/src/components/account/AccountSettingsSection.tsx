import { Switch } from "../ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

export interface UserSettingsUpdate {
  usePasswordlessLogin: boolean;
  twoFactorEnabled: boolean;
  emailNotificationsEnabled: boolean;
  workflowNotificationsEnabled: boolean;
}

interface AccountSettingsUser {
  usePasswordlessLogin: boolean;
  twoFactorEnabled: boolean;
  emailNotificationsEnabled: boolean;
  workflowNotificationsEnabled: boolean;
}

interface IAccountSettingsSectionProps {
  user: AccountSettingsUser;
  saving: boolean;
  onSettingsChange: (settings: UserSettingsUpdate) => void;
  /**
   * Hides the login-method and 2FA controls (used in passwordless-only mode, where those values are
   * pinned server-side and must not be changed from the UI). Notification settings stay visible.
   */
  hideSecurityToggles?: boolean;
}

export function AccountSettingsSection({
  user,
  saving,
  onSettingsChange,
  hideSecurityToggles = false,
}: Readonly<IAccountSettingsSectionProps>) {
  const currentSettings: UserSettingsUpdate = {
    usePasswordlessLogin: user.usePasswordlessLogin,
    twoFactorEnabled: user.twoFactorEnabled,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
    workflowNotificationsEnabled: user.workflowNotificationsEnabled,
  };

  const handleChange = (field: keyof UserSettingsUpdate, value: boolean) => {
    onSettingsChange({ ...currentSettings, [field]: value });
  };

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-base font-semibold text-foreground">
          Account Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hideSecurityToggles && (
          <>
            <div className="border-b border-border px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Security
              </p>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Passwordless Login
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Allow login with email and magic link only.
                  </p>
                </div>
                <Switch
                  checked={user.usePasswordlessLogin}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    handleChange("usePasswordlessLogin", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to this account.
                  </p>
                </div>
                <Switch
                  checked={user.twoFactorEnabled}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    handleChange("twoFactorEnabled", checked)
                  }
                />
              </div>
            </div>
          </>
        )}
        <div className="border-b border-t border-border px-6 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notifications
          </p>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Email Notifications
              </p>
              <p className="text-sm text-muted-foreground">
                Receive system updates and alerts via email.
              </p>
            </div>
            <Switch
              checked={user.emailNotificationsEnabled}
              disabled={saving}
              onCheckedChange={(checked) =>
                handleChange("emailNotificationsEnabled", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Workflow Notifications
              </p>
              <p className="text-sm text-muted-foreground">
                Receive notifications for workflow status changes.
              </p>
            </div>
            <Switch
              checked={user.workflowNotificationsEnabled}
              disabled={saving}
              onCheckedChange={(checked) =>
                handleChange("workflowNotificationsEnabled", checked)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
