import { useState } from "react";
import { tenantInviteApi } from "../api/TenantInviteApi";
import {
  InviteOutcome,
  PriorMemberChoice,
  type IPriorMemberPrompt,
} from "../models";
import { useLogger } from "../logger/useLogger";
import { parseError } from "../lib/utils";
import PriorMemberChoicePrompt from "./PriorMemberChoicePrompt";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "./ui/use-toast";

interface IRestorePriorMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: IPriorMemberPrompt[];
  onInvitesCreated?: () => void;
}

/**
 * Confirms restore of prior Detached members by sending restore invites.
 * Matches the prior-member step used by {@link InviteUsersDialog}.
 */
function RestorePriorMemberDialog({
  open,
  onOpenChange,
  prompts,
  onInvitesCreated,
}: Readonly<IRestorePriorMemberDialogProps>) {
  const logger = useLogger("RestorePriorMemberDialog");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (submitting) return;
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (prompts.length === 0) return;

    setSubmitting(true);
    try {
      for (const prompt of prompts) {
        const response = await tenantInviteApi.confirmPriorMemberChoice({
          email: prompt.email,
          choice: PriorMemberChoice.ReAdd,
        });
        const inviteOutcome = response.inviteResponse?.results?.[0]?.outcome;
        toast({
          title:
            inviteOutcome === InviteOutcome.AlreadyPending
              ? `Restore invite pending for ${prompt.email}`
              : `Invite sent to ${prompt.email}`,
          description:
            inviteOutcome === InviteOutcome.AlreadyPending
              ? "A pending invite already exists for this address."
              : `They must accept the invite to restore access as ${prompt.priorRole}.`,
        });
      }
      onInvitesCreated?.();
      onOpenChange(false);
    } catch (err) {
      logger.handleError(err, "confirmPriorMemberChoice");
      toast({
        title: "Failed to send restore invite",
        description: parseError(err).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open || submitting} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore prior member</DialogTitle>
          <DialogDescription>
            This address was previously a member of this workspace. Confirm to
            send an invite; they regain access after accepting.
          </DialogDescription>
        </DialogHeader>

        {prompts.length > 0 && <PriorMemberChoicePrompt prompts={prompts} />}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || prompts.length === 0}
          >
            {submitting ? "Sending invite…" : "Send restore invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RestorePriorMemberDialog;
