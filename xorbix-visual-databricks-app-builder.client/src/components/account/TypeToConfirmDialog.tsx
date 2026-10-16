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

interface ITypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationPhrase: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
}

function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationPhrase,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isPending = false,
  onConfirm,
}: Readonly<ITypeToConfirmDialogProps>) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setTyped("");
    }
  }, [open]);

  const matches = typed.trim() === confirmationPhrase.trim();
  const canConfirm = matches && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="type-to-confirm-input">
            Type{" "}
            <span className="font-mono font-semibold">
              {confirmationPhrase}
            </span>{" "}
            to confirm
          </Label>
          <Input
            id="type-to-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmationPhrase}
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TypeToConfirmDialog;
