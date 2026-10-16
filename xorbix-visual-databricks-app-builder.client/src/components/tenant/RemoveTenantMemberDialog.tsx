import { useCallback } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { toast } from "../ui/use-toast";
import { useRemoveTenantMember } from "../../hooks/useRemoveTenantMember";
import { useLogger } from "../../logger/useLogger";
import { parseError } from "../../lib/utils";
import type { SeatUserRow } from "../../types/seatTable";

interface IRemoveTenantMemberDialogProps {
  tenantId: string;
  tenantName?: string;
  /** The seat row whose user is being removed; `null` closes the dialog. */
  target: SeatUserRow | null;
  onOpenChange: (open: boolean) => void;
}

function describeTarget(target: SeatUserRow | null): string {
  return (
    target?.user?.fullName ||
    target?.user?.email ||
    target?.seat.userDisplayName ||
    target?.seat.userEmail ||
    "this user"
  );
}

/**
 * Global-administrator confirmation for removing a member from a specific
 * tenant. Frees the member's seat without changing billing.
 */
const RemoveTenantMemberDialog = ({
  tenantId,
  tenantName,
  target,
  onOpenChange,
}: Readonly<IRemoveTenantMemberDialogProps>) => {
  const logger = useLogger("RemoveTenantMemberDialog");
  const { removeTenantMember, isRemoving } = useRemoveTenantMember(tenantId);
  const targetName = describeTarget(target);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isRemoving) return;
      onOpenChange(open);
    },
    [isRemoving, onOpenChange],
  );

  const confirmRemove = useCallback(async () => {
    const userId = target?.user?.id;
    if (!userId) return;
    try {
      await removeTenantMember(userId);
      toast({
        title: "Removed from tenant",
        description: `${targetName} no longer has access to this tenant.`,
      });
      onOpenChange(false);
    } catch (err) {
      logger.UI.error("Failed to remove user from tenant:", err);
      toast({
        title: "Could not remove user from tenant",
        description:
          parseError(err).message ||
          "You may not have permission to remove this member, or they may no longer belong to this tenant.",
        variant: "destructive",
      });
    }
  }, [target, targetName, removeTenantMember, onOpenChange, logger]);

  return (
    <Dialog open={target !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove user from tenant?</DialogTitle>
          <DialogDescription>
            Remove {targetName}
            {tenantName ? ` from ${tenantName}` : ""}? They lose access to this
            tenant immediately and any seat they occupy is released for
            reassignment. Billing is not changed, and their VDAB account and
            any other tenants are unaffected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmRemove}
            disabled={isRemoving}
          >
            {isRemoving ? "Removing..." : "Remove from tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveTenantMemberDialog;
