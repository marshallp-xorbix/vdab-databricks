import { useState } from "react";
import { Edit, Save, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Chip } from "../ui/chip";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

interface BasicInfoUser {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirmed: boolean;
  userName: string;
  phoneNumber?: string;
  phoneNumberConfirmed?: boolean;
  createdOn: string | Date;
  lastLoginAt?: string | Date;
  azureAdObjectId?: string;
  accessFailedCount?: number;
  lockoutEnabled?: boolean;
  lockoutEnd?: string | Date;
  termsOfServiceVersionDate?: string;
  termsOfServiceAcceptedOn?: string | Date;
  privacyPolicyVersionDate?: string;
  privacyPolicyAcceptedOn?: string | Date;
}

interface IUserDetailInfoCardProps {
  user: BasicInfoUser;
  isAdmin: boolean;
  /**
   * Whether the viewer may edit the basic information. Defaults to true.
   * Set to false to render a read-only card (for example when a tenant admin
   * views a guest of their tenant whose profile they do not own).
   */
  canEdit?: boolean;
  saving: boolean;
  onSave: (data: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    clearAzureAdObjectId?: boolean;
  }) => Promise<void>;
}

export function UserDetailInfoCard({
  user,
  isAdmin,
  canEdit = true,
  saving,
  onSave,
}: Readonly<IUserDetailInfoCardProps>) {
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [clearAzureAdObjectId, setClearAzureAdObjectId] = useState(false);

  const formattedLastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString()
    : "Never";

  const startEditing = () => {
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditPhoneNumber(user.phoneNumber || "");
    setClearAzureAdObjectId(false);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) return;
    await onSave({
      firstName: editFirstName,
      lastName: editLastName,
      phoneNumber: editPhoneNumber || undefined,
      clearAzureAdObjectId: isAdmin && clearAzureAdObjectId ? true : undefined,
    });
    setEditing(false);
  };

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Basic Information
          </CardTitle>
          {!editing && canEdit && (
            <Button
              title="Edit"
              variant="ghost"
              size="icon"
              onClick={startEditing}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
          {editing ? (
            <>
              <div>
                <Label
                  htmlFor="editFirstName"
                  className="text-sm text-muted-foreground"
                >
                  First Name
                </Label>
                <Input
                  id="editFirstName"
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="editLastName"
                  className="text-sm text-muted-foreground"
                >
                  Last Name
                </Label>
                <Input
                  id="editLastName"
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-sm text-muted-foreground">Full Name</Label>
              <p className="mt-1 text-sm font-medium text-foreground">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : "N/A"}
              </p>
            </div>
          )}
          <div>
            <Label className="text-sm text-muted-foreground">Email Address</Label>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              {user.emailConfirmed ? (
                <Chip variant="success">Confirmed</Chip>
              ) : (
                <Chip variant="warning">Unconfirmed</Chip>
              )}
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Username</Label>
            <p className="mt-1 text-sm font-medium text-foreground">
              {user.userName || "N/A"}
            </p>
          </div>
          {editing ? (
            <div>
              <Label
                htmlFor="editPhoneNumber"
                className="text-sm text-muted-foreground"
              >
                Phone Number
              </Label>
              <Input
                id="editPhoneNumber"
                type="tel"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Include country code (e.g. +1 for US, +44 for UK)
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-sm text-muted-foreground">Phone Number</Label>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {user.phoneNumber || "Not provided"}
                </p>
                {user.phoneNumber &&
                  (user.phoneNumberConfirmed ? (
                    <span className="inline-flex items-center rounded-full border border-success/30 bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-foreground">
                      Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-foreground">
                      Unconfirmed
                    </span>
                  ))}
              </div>
            </div>
          )}
          <div>
            <Label className="text-sm text-muted-foreground">Created On</Label>
            <p className="mt-1 text-sm text-foreground">
              {user.createdOn
                ? new Date(user.createdOn).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Last Login</Label>
            <p className="mt-1 text-sm text-foreground">{formattedLastLogin}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-4 text-sm font-semibold text-foreground">
              Azure AD & Identity
            </h4>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Azure AD Object ID
                </Label>
                {editing && user.azureAdObjectId ? (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="truncate text-sm font-mono text-foreground">
                      {clearAzureAdObjectId
                        ? "Will be cleared on save"
                        : user.azureAdObjectId}
                    </p>
                    {clearAzureAdObjectId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setClearAzureAdObjectId(false)}
                      >
                        Undo
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Clear Azure AD Object ID"
                        onClick={() => setClearAzureAdObjectId(true)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 truncate text-sm font-mono text-foreground">
                    {user.azureAdObjectId || "Not linked"}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Access Failed Count
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.accessFailedCount}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Lockout Enabled
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.lockoutEnabled ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Lockout End</Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.lockoutEnd
                    ? new Date(user.lockoutEnd).toLocaleString()
                    : "Not locked out"}
                </p>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-4 text-sm font-semibold text-foreground">
              Policy Consent
            </h4>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Terms of Service Version
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.termsOfServiceVersionDate || "None"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Terms of Service Accepted On
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.termsOfServiceAcceptedOn
                    ? new Date(user.termsOfServiceAcceptedOn).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Privacy Policy Version
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.privacyPolicyVersionDate || "None"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Privacy Policy Accepted On
                </Label>
                <p className="mt-1 text-sm text-foreground">
                  {user.privacyPolicyAcceptedOn
                    ? new Date(user.privacyPolicyAcceptedOn).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
