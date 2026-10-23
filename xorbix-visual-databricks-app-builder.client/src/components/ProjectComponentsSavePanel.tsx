import { Button } from "./ui/button";
import ProjectPreviewPanel from "./ProjectPreviewPanel";
import type { IProjectPreview } from "../models/ProjectComponents";

interface IProjectComponentsSavePanelProps {
  isDirty: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  isSaveDisabled: boolean;
  saveError: string | null;
  preview: IProjectPreview | null;
  isPreviewing: boolean;
  previewError: string | null;
  onSave: () => void;
  onReload: () => void;
  onPreview: () => void;
}

function ProjectComponentsSavePanel({
  isDirty,
  isSaving,
  isDisabled,
  isSaveDisabled,
  saveError,
  preview,
  isPreviewing,
  previewError,
  onSave,
  onReload,
  onPreview,
}: Readonly<IProjectComponentsSavePanelProps>) {
  return (
    <>
      {saveError && (
        <div role="alert" className="grid gap-2">
          <p>{saveError}</p>
          <div>
            <Button type="button" variant="outline" onClick={onReload}>
              Reload latest components
            </Button>
          </div>
        </div>
      )}
      {isDirty && <p role="status">Component changes are not saved.</p>}
      {!isDirty && isSaving && <p role="status">Saving components…</p>}
      {!isDirty && !isSaving && (
        <p role="status" aria-live="polite">
          Components saved.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={isDisabled || isSaveDisabled || !isDirty || isSaving}
          onClick={onSave}
        >
          {isSaving ? "Saving…" : "Save components"}
        </Button>
      </div>
      <ProjectPreviewPanel
        preview={preview}
        isPending={isPreviewing}
        isDisabled={isDisabled || isDirty}
        errorMessage={previewError}
        onPreview={onPreview}
      />
    </>
  );
}

export default ProjectComponentsSavePanel;
