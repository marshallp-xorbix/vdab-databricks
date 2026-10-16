import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface IGlobalRolesTabProps {
  availableRoles: string[];
  selectedRoles: string[];
  rolesChanged: boolean;
  saving: boolean;
  onToggleRole: (role: string) => void;
  onReset: () => void;
  onSave: () => void;
}

/**
 * Editor for a user's global ASP.NET Identity roles. Shown on the global-admin
 * surface of the user-detail page; the tenant surface uses `TenantRoleTab`
 * instead, which edits the tenant membership role rather than platform roles.
 */
export function GlobalRolesTab({
  availableRoles,
  selectedRoles,
  rolesChanged,
  saving,
  onToggleRole,
  onReset,
  onSave,
}: Readonly<IGlobalRolesTabProps>) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-3">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-base font-semibold text-foreground">
              Manage Role Access
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign roles to define user permissions within the system.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {availableRoles.length > 0 ? (
              <div className="space-y-3">
                {availableRoles.map((role) => {
                  const selected = selectedRoles.includes(role);

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
                        onCheckedChange={() => onToggleRole(role)}
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

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={!rolesChanged || saving}
              >
                Reset
              </Button>
              <Button
                onClick={onSave}
                disabled={!rolesChanged || saving}
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {saving ? "Saving..." : "Save Role Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default GlobalRolesTab;
