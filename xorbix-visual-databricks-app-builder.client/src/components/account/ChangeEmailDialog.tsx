import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type ChangeEmailMode = "self" | "admin";

interface IChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ChangeEmailMode;
  currentEmail?: string;
  saving?: boolean;
  requireCurrentPassword?: boolean;
  onSubmit: (
    newEmail: string,
    currentPassword?: string,
  ) => void | Promise<void>;
}

export function ChangeEmailDialog({
  open,
  onOpenChange,
  mode,
  currentEmail,
  saving = false,
  requireCurrentPassword = false,
  onSubmit,
}: Readonly<IChangeEmailDialogProps>) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setNewEmail("");
      setCurrentPassword("");
    }
  }, [open]);

  const isSelf = mode === "self";
  const showPasswordField = isSelf && requireCurrentPassword;
  const title = isSelf ? "Change Email Address" : "Change Email";
  const description = isSelf ? (
    <>
      A confirmation link will be sent to your new email address and a security
      notice will be sent to your current address. Your email will not change
      until you confirm from the new address.
      {currentEmail && (
        <>
          {" "}
          Your current email is <strong>{currentEmail}</strong>.
        </>
      )}
    </>
  ) : (
    <>
      Enter the new email address for this user. A confirmation link will be
      sent to the new address and a security notice to the current address. The
      email will not change until the user confirms from the new address.
    </>
  );
  const submitLabel = (() => {
    if (!isSelf) return "Change Email";
    return saving ? "Sending..." : "Send Verification";
  })();

  const canSubmit =
    !!newEmail.trim() && (!showPasswordField || !!currentPassword.trim());

  const handleSubmit = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (showPasswordField && !currentPassword.trim()) return;
    await onSubmit(trimmed, showPasswordField ? currentPassword : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="change-email-new">New Email Address</Label>
          <Input
            id="change-email-new"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        {showPasswordField && (
          <div className="space-y-3 py-2">
            <Label htmlFor="change-email-password">Current Password</Label>
            <Input
              id="change-email-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className={
              isSelf
                ? undefined
                : "bg-primary text-primary-foreground hover:bg-primary-hover"
            }
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
