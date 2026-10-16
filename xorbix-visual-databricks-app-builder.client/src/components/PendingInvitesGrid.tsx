import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { tenantInviteApi } from "../api/TenantInviteApi";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import { TenantInvite } from "../models";
import { useLogger } from "../logger/useLogger";

interface IPendingInvitesGridProps {
  invites: TenantInvite[];
  onChanged: () => void;
}

function PendingInvitesGrid({
  invites,
  onChanged,
}: Readonly<IPendingInvitesGridProps>) {
  const logger = useLogger("PendingInvitesGrid");
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCancel = async (invite: TenantInvite) => {
    setBusyId(invite.id);
    try {
      await tenantInviteApi.cancelInvite(invite.id);
      toast({ title: `Canceled invite for ${invite.email}` });
      onChanged();
    } catch (err) {
      logger.handleError(err, "cancelInvite");
      toast({ title: "Failed to cancel invite", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (invite: TenantInvite) => {
    setBusyId(invite.id);
    try {
      await tenantInviteApi.resendInvite(invite.id);
      toast({ title: `Resent invite to ${invite.email}` });
      onChanged();
    } catch (err) {
      logger.handleError(err, "resendInvite");
      toast({ title: "Failed to resend invite", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No pending invites.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Invited</th>
            <th className="px-4 py-2">Expires</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invites.map((invite) => {
            const invitedAt =
              invite.invitedAt instanceof Date
                ? invite.invitedAt.toLocaleDateString()
                : new Date(invite.invitedAt).toLocaleDateString();
            const expiresAt =
              invite.tokenExpiresAt instanceof Date
                ? invite.tokenExpiresAt.toLocaleDateString()
                : new Date(invite.tokenExpiresAt).toLocaleDateString();
            const isBusy = busyId === invite.id;
            return (
              <tr key={invite.id}>
                <td className="px-4 py-2">{invite.email}</td>
                <td className="px-4 py-2 text-muted-foreground">{invitedAt}</td>
                <td className="px-4 py-2 text-muted-foreground">{expiresAt}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleResend(invite)}
                      aria-label={`Resend invite to ${invite.email}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Resend
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleCancel(invite)}
                      aria-label={`Cancel invite for ${invite.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PendingInvitesGrid;
