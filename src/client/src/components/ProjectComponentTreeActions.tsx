import { useState } from "react";
import type { IProjectComponent } from "../models/ProjectComponents";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface IProjectComponentTreeActionsProps {
  component: IProjectComponent | undefined;
  isDisabled: boolean;
  isRemoveDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function ProjectComponentTreeActions({
  component,
  isDisabled,
  isRemoveDisabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Readonly<IProjectComponentTreeActionsProps>) {
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);

  function confirmRemoval() {
    onRemove();
    setConfirmationOpen(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={isDisabled || !component || !canMoveUp}
        aria-label="Move selected component up"
        onClick={onMoveUp}
      >
        Move up
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isDisabled || !component || !canMoveDown}
        aria-label="Move selected component down"
        onClick={onMoveDown}
      >
        Move down
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={isDisabled || isRemoveDisabled || !component}
        onClick={() => setConfirmationOpen(true)}
      >
        Remove selected component
      </Button>
      {isRemoveDisabled && (
        <p role="status" className="basis-full text-sm text-muted-foreground">
          Workflows must load before a component can be removed safely.
        </p>
      )}
      <Dialog open={isConfirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {component?.type ?? "component"}?</DialogTitle>
            <DialogDescription>
              This also removes its nested children. Workflows triggered by or
              referencing the removed components are removed from the draft.
              Save that workflow draft before component auto-save resumes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDisabled}
              onClick={() => setConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDisabled || isRemoveDisabled || !component}
              onClick={confirmRemoval}
            >
              Remove component
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectComponentTreeActions;
