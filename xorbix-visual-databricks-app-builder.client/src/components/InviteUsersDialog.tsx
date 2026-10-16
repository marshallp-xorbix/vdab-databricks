import { useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { tenantInviteApi } from "../api/TenantInviteApi";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "./ui/use-toast";
import {
  InviteOutcome,
  PriorMemberChoice,
  type IPriorMemberPrompt,
} from "../models";
import { useLogger } from "../logger/useLogger";
import { parseError } from "../lib/utils";
import PriorMemberChoicePrompt from "./PriorMemberChoicePrompt";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IInviteUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSeats: number;
  onInvitesCreated?: () => void;
}

function InviteUsersDialog({
  open,
  onOpenChange,
  availableSeats,
  onInvitesCreated,
}: Readonly<IInviteUsersDialogProps>) {
  const logger = useLogger("InviteUsersDialog");
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [priorPrompts, setPriorPrompts] = useState<IPriorMemberPrompt[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const overage = useMemo(
    () => Math.max(0, emails.length - availableSeats),
    [emails.length, availableSeats],
  );

  const validate = (
    candidate: string,
    ignoreIndex: number | null,
  ): string | null => {
    if (!candidate) return "Email is required";
    if (!EMAIL_REGEX.test(candidate)) return "Enter a valid email address";
    const existingIndex = emails.findIndex(
      (e) => e.toLowerCase() === candidate.toLowerCase(),
    );
    if (existingIndex !== -1 && existingIndex !== ignoreIndex) {
      return "Email already added";
    }
    return null;
  };

  const commitInput = () => {
    const candidate = input.trim();
    const validationError = validate(candidate, editingIndex);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (editingIndex === null) {
      setEmails((prev) => [...prev, candidate]);
    } else {
      setEmails((prev) =>
        prev.map((e, i) => (i === editingIndex ? candidate : e)),
      );
      setEditingIndex(null);
    }
    setInput("");
    setError(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setInput(emails[index]);
    setError(null);
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setInput("");
    setError(null);
  };

  const handleRemove = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      handleCancelEdit();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const resetState = () => {
    setEmails([]);
    setInput("");
    setError(null);
    setEditingIndex(null);
    setSubmitting(false);
    setAcknowledged(false);
    setPriorPrompts([]);
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) resetState();
    onOpenChange(next);
  };

  const outcomeToToast = (
    email: string,
    outcome: InviteOutcome,
    message?: string,
  ) => {
    switch (outcome) {
      case InviteOutcome.Created:
        toast({ title: `Invited ${email}` });
        break;
      case InviteOutcome.AlreadyPending:
        toast({ title: `${email} already has a pending invite` });
        break;
      case InviteOutcome.AlreadyMember:
        toast({
          title: `${email} is already a member`,
          variant: "destructive",
        });
        break;
      case InviteOutcome.PriorMemberChoiceRequired:
        break;
      case InviteOutcome.Invalid:
      default:
        toast({
          title: `Could not invite ${email}`,
          description: message,
          variant: "destructive",
        });
        break;
    }
  };

  const handleSubmit = async () => {
    if (emails.length === 0) {
      toast({
        title: "Add at least one email to invite",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await tenantInviteApi.createInvites({ emails });
      const prompts = response.results
        .filter(
          (r) =>
            r.outcome === InviteOutcome.PriorMemberChoiceRequired &&
            r.priorMember,
        )
        .map((r) => r.priorMember!);

      for (const r of response.results) {
        outcomeToToast(r.email, r.outcome, r.message);
      }
      if (response.seatOverageCount > 0 && prompts.length === 0) {
        toast({
          title: `${response.seatOverageCount} invitee(s) will require one or more additional seats`,
          description:
            "A prorated seat is will be added to your subscription when each invitee accepts.",
        });
      }

      if (prompts.length > 0) {
        setPriorPrompts(prompts);
        onInvitesCreated?.();
        return;
      }

      onInvitesCreated?.();
      resetState();
      onOpenChange(false);
    } catch (err) {
      logger.handleError(err, "createInvites");
      toast({
        title: "Failed to send invites",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPriorMembers = async () => {
    setSubmitting(true);
    try {
      for (const prompt of priorPrompts) {
        const key = prompt.email.toLowerCase();
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

        // Drop confirmed prompts so a mid-batch failure leaves only remaining ones to retry.
        setPriorPrompts((prev) =>
          prev.filter((p) => p.email.toLowerCase() !== key),
        );
      }
      onInvitesCreated?.();
      resetState();
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

  const isEditing = editingIndex !== null;
  const overageLabel = overage === 1 ? "a new seat" : "new seats";
  const showingPriorPrompt = priorPrompts.length > 0;

  return (
    <Dialog open={open || submitting} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {showingPriorPrompt ? "Restore prior member" : "Invite users"}
          </DialogTitle>
          <DialogDescription>
            {showingPriorPrompt
              ? "This address was previously a member of this workspace. Confirm to send an invite; they regain access after accepting."
              : "Enter an email address and press Enter to add it to the list."}
          </DialogDescription>
        </DialogHeader>

        {showingPriorPrompt ? (
          <PriorMemberChoicePrompt prompts={priorPrompts} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email-input">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email-input"
                  ref={inputRef}
                  type="email"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="user@example.com"
                  aria-invalid={error ? true : undefined}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant={isEditing ? "default" : "outline"}
                  onClick={commitInput}
                  disabled={submitting}
                >
                  {isEditing ? "Update" : "Add"}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            {emails.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email, index) => (
                      <TableRow
                        key={email}
                        data-state={
                          editingIndex === index ? "selected" : undefined
                        }
                      >
                        <TableCell className="font-mono text-sm">
                          {email}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(index)}
                              disabled={submitting}
                              aria-label={`Edit ${email}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(index)}
                              disabled={submitting}
                              aria-label={`Remove ${email}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {emails.length} email{emails.length === 1 ? "" : "s"}
              {` · ${availableSeats} open seat${availableSeats === 1 ? "" : "s"}${overage > 0 ? ` · ${overage} will require ${overageLabel}` : ""}`}
            </p>

            {overage > 0 && (
              <div className="space-y-3 rounded-md border border-warning/40 bg-warning-subtle p-3">
                <p className="text-xs text-warning-foreground">
                  {overage} of these invite{overage === 1 ? "" : "s"}{" "}
                  {overage === 1 ? "exceeds" : "exceed"} your {availableSeats}{" "}
                  open seat{availableSeats === 1 ? "" : "s"}. Each invitee who
                  accepts beyond your open seats adds a paid seat to your
                  subscription. New seats are prorated and added to your next
                  invoice — no charge is made until the invitee accepts.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="seat-overage-ack"
                    checked={acknowledged}
                    onCheckedChange={(checked) =>
                      setAcknowledged(checked === true)
                    }
                    disabled={submitting}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="seat-overage-ack"
                    className="text-xs font-normal text-warning-foreground"
                  >
                    I understand that accepted invites beyond my open seats will
                    add paid seats to my subscription.
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          {showingPriorPrompt ? (
            <Button
              type="button"
              onClick={() => void handleConfirmPriorMembers()}
              disabled={submitting}
            >
              {submitting ? "Sending invite…" : "Send restore invite"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                submitting ||
                emails.length === 0 ||
                (overage > 0 && !acknowledged)
              }
            >
              {submitting ? "Sending…" : "Send invites"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteUsersDialog;
