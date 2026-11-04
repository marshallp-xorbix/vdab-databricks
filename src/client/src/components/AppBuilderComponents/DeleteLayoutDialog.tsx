/**
 * Confirmation dialog for deleting a layout with child components
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

interface DeleteLayoutDialogProps {
  isOpen: boolean;
  layoutName: string;
  componentCount: number;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

const DeleteLayoutDialog: FC<DeleteLayoutDialogProps> = ({
  isOpen,
  layoutName,
  componentCount,
  onConfirmDelete,
  onCancel,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="bg-muted border-border"
      >
        <DialogHeader>
          <DialogTitle>Delete Layout</DialogTitle>
          <DialogDescription>
            The layout "{layoutName}" contains child components.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-foreground">
            This will delete the layout and {componentCount} child component
            {componentCount !== 1 ? "s" : ""}.
          </p>
          <p className="mt-3 text-sm font-medium text-destructive">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirmDelete}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            Delete Layout and Children
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteLayoutDialog;
