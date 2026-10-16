import { useState, useEffect } from "react";
import { useParams, useNavigate, useMatches } from "react-router-dom";
import { Edit, Info, Save } from "lucide-react";
import { useUserManagement } from "../hooks/useUserManagement";
import { useClientConfig } from "../hooks/useClientConfig";
import { useTenantManagement } from "../hooks/useTenantManagement";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { AddUserRequest } from "../models";
import { toast } from "../components/ui/use-toast";

const NO_TENANT_VALUE = "none";

function UserEdit() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const matches = useMatches();

  const isNewUser = matches.some((m) => m.id === "user-new");

  const {
    userRoles: initialRoles,
    availableRoles,
    loading,
    error,
    loadUser,
    loadAvailableRoles,
    addUser,
    updateUser,
    manageRoles,
    updateUserSettings,
  } = useUserManagement(!isNewUser);
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();
  const { tenants, isLoading: tenantsLoading } = useTenantManagement();
  // Hide the security toggles until the runtime config resolves so they never flash before
  // passwordless-only mode is known.
  const showSecurityToggles = isConfigLoaded && !passwordlessOnly;

  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [tenantId, setTenantId] = useState<string>(NO_TENANT_VALUE);
  const [usePasswordlessLogin, setUsePasswordlessLogin] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [workflowNotificationsEnabled, setWorkflowNotificationsEnabled] =
    useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  useEffect(() => {
    loadAvailableRoles();
    if (!isNewUser && userId) {
      loadUser(userId).then((loadedUser) => {
        if (loadedUser) {
          setEmail(loadedUser.email);
          setFirstName(loadedUser.firstName);
          setLastName(loadedUser.lastName);
          setRoles(loadedUser.roles || []);
          setUsePasswordlessLogin(loadedUser.usePasswordlessLogin);
          setTwoFactorEnabled(loadedUser.twoFactorEnabled);
          setEmailNotificationsEnabled(loadedUser.emailNotificationsEnabled);
          setWorkflowNotificationsEnabled(
            loadedUser.workflowNotificationsEnabled,
          );
        }
      });
    }
  }, [userId, isNewUser, loadUser, loadAvailableRoles]);

  const handleSave = async () => {
    if (!email.trim()) {
      toast({
        title: "Validation error",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }
    if (!firstName.trim()) {
      toast({
        title: "Validation error",
        description: "First name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!lastName.trim()) {
      toast({
        title: "Validation error",
        description: "Last name is required.",
        variant: "destructive",
      });
      return;
    }

    // In passwordless-only mode the login method and 2FA are pinned on regardless of the (hidden) toggles.
    const effectiveUsePasswordlessLogin = passwordlessOnly || usePasswordlessLogin;
    const effectiveTwoFactorEnabled = passwordlessOnly || twoFactorEnabled;

    setSaving(true);
    try {
      if (isNewUser) {
        const request = new AddUserRequest({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roles: roles,
          usePasswordlessLogin: effectiveUsePasswordlessLogin,
          sendWelcomeEmail: sendWelcomeEmail,
          tenantId:
            tenantId === NO_TENANT_VALUE || !tenantId ? undefined : tenantId,
        });
        const success = await addUser(request);
        if (success) {
          setTimeout(() => navigate("/administration/users"), 1000);
        }
      } else {
        const resolvedUserId = userId!;
        const success = await updateUser(resolvedUserId, {
          firstName,
          lastName,
        });
        if (!success) return;

        const rolesToAdd = roles.filter((r) => !initialRoles.includes(r));
        const rolesToRemove = initialRoles.filter((r) => !roles.includes(r));

        if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
          const rolesSuccess = await manageRoles(resolvedUserId, {
            rolesToAdd: rolesToAdd.length > 0 ? rolesToAdd : undefined,
            rolesToRemove: rolesToRemove.length > 0 ? rolesToRemove : undefined,
          });
          if (!rolesSuccess) return;
        }

        await updateUserSettings(resolvedUserId, {
          usePasswordlessLogin: effectiveUsePasswordlessLogin,
          twoFactorEnabled: effectiveTwoFactorEnabled,
          emailNotificationsEnabled,
          workflowNotificationsEnabled,
        });

        setTimeout(() => navigate(`/administration/users/${userId}`), 1000);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  let saveButtonLabel = "Save Changes";
  if (saving) {
    saveButtonLabel = "Saving...";
  } else if (isNewUser) {
    saveButtonLabel = "Create User";
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 pb-28 md:p-8 md:pb-32">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm md:p-7">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Edit className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isNewUser ? "Add User" : "Edit User"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNewUser
              ? "Create a new user account and assign initial access."
              : `Update user information, roles, and security settings for ${
                  firstName || "this user"
                } ${lastName || ""}.`}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-lg font-medium text-foreground">
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm text-foreground">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm text-foreground">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm text-foreground">
                    Email Address{" "}
                    {isNewUser && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-1"
                    disabled={!isNewUser}
                  />
                  {!isNewUser && (
                    <p className="mt-1 flex items-center text-xs text-muted-foreground">
                      <Info className="mr-1 h-3 w-3" />
                      Email changes require re-verification and are handled on
                      the user details page.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm text-foreground">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    disabled
                    className="mt-1 bg-muted text-muted-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Soon to be added</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isNewUser && (
          <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border bg-muted/50">
              <CardTitle className="text-lg font-medium text-foreground">
                Account Membership
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Optionally add this user to a tenant when creating the account.
                You can also add them later from the user detail page.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <Label htmlFor="tenantId" className="text-sm text-foreground">
                Tenant
              </Label>
              <Select
                value={tenantId}
                onValueChange={setTenantId}
                disabled={tenantsLoading}
              >
                <SelectTrigger id="tenantId" className="mt-1">
                  <SelectValue placeholder="No tenant (add later)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TENANT_VALUE}>
                    No tenant (add later)
                  </SelectItem>
                  {tenants
                    .filter((tenant) => tenant.isActive)
                    .map((tenant) => (
                      <SelectItem
                        key={tenant.tenantId}
                        value={tenant.tenantId}
                      >
                        {tenant.displayName || tenant.tenantName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-lg font-medium text-foreground">
              Role Assignment
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign roles to define user permissions within the system.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {availableRoles.length > 0 ? (
              <div className="space-y-3">
                {availableRoles.map((role) => {
                  const selected = roles.includes(role);
                  return (
                    <label
                      key={role}
                      htmlFor={`role-${role}`}
                      className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${
                        selected
                          ? "border-primary/35 bg-primary/10"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <Checkbox
                        id={`role-${role}`}
                        checked={selected}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <div className="ml-3 flex-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {role}
                          </span>
                          {selected && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                              Assigned
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Permission details for this role are coming soon.
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No roles available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-lg font-medium text-foreground">
              Security & Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {showSecurityToggles && (
              <>
                <div className="border-b border-border px-6 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Security
                  </p>
                </div>
                <div className="divide-y divide-gray-200">
                  <div className="flex items-center justify-between p-6">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Passwordless Login
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Allow user to log in via magic link only.
                      </p>
                    </div>
                    <Switch
                      id="passwordless"
                      checked={usePasswordlessLogin}
                      onCheckedChange={(checked) =>
                        setUsePasswordlessLogin(checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-6">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Two-Factor Authentication (2FA)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Enforce 2FA for this user upon next login.
                      </p>
                    </div>
                    <Switch
                      id="twoFactor"
                      checked={twoFactorEnabled}
                      onCheckedChange={(checked) =>
                        setTwoFactorEnabled(checked)
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
            <div className="divide-y divide-gray-200">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Email Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive system updates and alerts via email.
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={emailNotificationsEnabled}
                  onCheckedChange={(checked) =>
                    setEmailNotificationsEnabled(checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Workflow Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for workflow status changes.
                  </p>
                </div>
                <Switch
                  id="workflowNotifications"
                  checked={workflowNotificationsEnabled}
                  onCheckedChange={(checked) =>
                    setWorkflowNotificationsEnabled(checked)
                  }
                />
              </div>
              {isNewUser && (
                <div className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Send Welcome Email
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Send account setup instructions after user creation.
                    </p>
                  </div>
                  <Switch
                    id="welcomeEmail"
                    checked={sendWelcomeEmail}
                    onCheckedChange={(checked) => setSendWelcomeEmail(checked)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/90 bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (isNewUser) {
                navigate("/administration/users");
              } else {
                navigate(`/administration/users/${userId}`);
              }
            }}
          >
            Cancel
          </Button>

          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Save className="mr-2 h-4 w-4" />
              {saveButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserEdit;
