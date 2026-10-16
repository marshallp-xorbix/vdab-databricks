/**
 * Confirmation dialog for deleting a modal and its components
 */

import { type FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

interface DeleteModalDialogProps {
  isOpen: boolean;
  modalName: string;
  componentCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteModalDialog: FC<DeleteModalDialogProps> = ({
  isOpen,
  modalName,
  componentCount,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="bg-muted border-border"
      >
        <DialogHeader>
          <DialogTitle>Delete Modal</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the modal "{modalName}"?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-foreground">
            This will permanently delete:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
            <li>The modal component</li>
            {componentCount > 0 && (
              <li>
                {componentCount} child component
                {componentCount !== 1 ? "s" : ""} inside the modal
              </li>
            )}
          </ul>
          <p className="mt-3 text-sm font-medium text-destructive">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            Delete Modal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteModalDialog;
