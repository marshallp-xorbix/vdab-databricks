import { Button } from "./ui/button";

interface IProjectEditorUnsavedChangesDialogProps {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/** Confirms whether a blocked navigation should discard project drafts. */
function ProjectEditorUnsavedChangesDialog({
  isOpen,
  onKeepEditing,
  onDiscard,
}: Readonly<IProjectEditorUnsavedChangesDialogProps>) {
  if (!isOpen) return null;

  return (
    <section
      aria-labelledby="unsaved-heading"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="alertdialog"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 id="unsaved-heading" className="text-lg font-semibold">
          Discard unsaved changes?
        </h2>
        <p className="text-sm text-muted-foreground">
          Your project edits have not been saved.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            Discard changes
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ProjectEditorUnsavedChangesDialog;
