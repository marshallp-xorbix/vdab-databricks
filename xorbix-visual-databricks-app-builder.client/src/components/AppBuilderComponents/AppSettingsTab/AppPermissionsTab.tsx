import { useMemo, useState } from "react";

import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import SettingsCard from "./SettingsCard";

const FAKE_USERS = [
  "connor.willans@xorbix.com",
  "alexander.drobek@xorbix.com",
  "tim.connolley@xorbix.com",
  "tyler.salaj@xorbix.com",
  "aiden.vandenbush@xorbix.com",
  "andrew.mcqueen@xorbix.com",
  "patrick.marshall@xorbix.com",
];

export default function AppPermissionsTab() {
  const [owner, setOwner] = useState<string>(FAKE_USERS[0]);
  const [viewers, setViewers] = useState<Set<string>>(new Set());

  const effectiveViewers = useMemo(() => {
    const next = new Set(viewers);
    next.add(owner);
    return next;
  }, [owner, viewers]);

  const toggleViewer = (email: string) => {
    if (email === owner) return;

    setViewers((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  return (
    <SettingsCard title="Permissions">
      <div className="space-y-6" data-property-nested-fields>
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-muted p-6 shadow-sm">
            <h2 className="text-base font-medium text-foreground">Owner</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The owner controls access and Databricks connections.
            </p>

            <Label
              className="mt-4 block text-sm text-foreground"
              htmlFor="ownerEmail"
            >
              Owner email
            </Label>
            <select
              id="ownerEmail"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="mt-1 w-full rounded-md border-0 bg-muted px-3 py-2 text-sm text-foreground shadow-none focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {FAKE_USERS.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-muted p-6 shadow-sm">
            <h2 className="text-base font-medium text-foreground">Who can view</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admins can always view. Add collaborators for this specific app.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="admin-always"
                  checked
                  disabled
                  className="border-border"
                />
                <Label
                  htmlFor="admin-always"
                  className="cursor-default text-sm text-foreground"
                >
                  Admin (always)
                </Label>
              </div>

              {FAKE_USERS.map((email) => {
                const id = `viewer-${email}`;
                const isOwner = email === owner;
                const checked = isOwner ? true : effectiveViewers.has(email);

                return (
                  <div key={email} className="flex items-center gap-3">
                    <Checkbox
                      id={id}
                      disabled={isOwner}
                      checked={checked}
                      onCheckedChange={() => {
                        if (!isOwner) toggleViewer(email);
                      }}
                      className="border-border"
                    />
                    <Label
                      htmlFor={id}
                      className={`text-sm ${
                        isOwner ? "text-muted-foreground" : "text-foreground"
                      } ${isOwner ? "cursor-default" : "cursor-pointer"}`}
                    >
                      {email} {isOwner ? "(owner)" : ""}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </SettingsCard>
  );
}
