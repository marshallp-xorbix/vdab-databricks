import { useState } from "react";
import { Button } from "./ui/button";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useDeleteProject } from "../hooks/useDeleteProject";
import type { IProject } from "../models/Project";

interface IProjectDeleteActionProps {
  project: IProject;
  renderAsMenuItem?: boolean;
}

/** Offers owner-only project deletion with clear child-App retention behavior. */
function ProjectDeleteAction({
  project,
  renderAsMenuItem = false,
}: Readonly<IProjectDeleteActionProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteProjectMutation = useDeleteProject();
  const canDelete =
    project.callerRole === "owner" ||
    project.callerRole === "installationAdmin";

  async function handleDelete() {
    try {
      await deleteProjectMutation.mutateAsync(project.id);
      setIsOpen(false);
    } catch {
      // The mutation error is displayed in the confirmation dialog.
    }
  }

  if (!canDelete) return null;

  function openConfirmation(event?: Event) {
    event?.preventDefault();
    setIsOpen(true);
  }

  return (
    <>
      {renderAsMenuItem ? (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={openConfirmation}
        >
          Delete project
        </DropdownMenuItem>
      ) : (
        <Button
          className="mt-4"
          type="button"
          variant="destructive"
          onClick={() => openConfirmation()}
        >
          Delete project
        </Button>
      )}
      <Dialog
        open={isOpen}
        onOpenChange={(open) =>
          !deleteProjectMutation.isPending && setIsOpen(open)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>
              This removes the project from VDAB and cannot be undone in the
              app. Any linked Databricks child App and its workspace source
              files will remain. Export the project first if you need a portable
              copy.
            </DialogDescription>
          </DialogHeader>
          {deleteProjectMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteProjectMutation.error instanceof Error
                ? deleteProjectMutation.error.message
                : "The project could not be deleted."}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteProjectMutation.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteProjectMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteProjectMutation.isPending ? "Deleting…" : "Remove project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProjectDeleteAction;
