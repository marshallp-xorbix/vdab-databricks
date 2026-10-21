import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface IProjectMetadataEditorProps {
  name: string;
  description: string;
  canEdit: boolean;
  isDirty: boolean;
  isDisabled: boolean;
  isSaving: boolean;
  isSaved: boolean;
  errorMessage: string | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onReload: () => void;
}

function ProjectMetadataEditor({
  name,
  description,
  canEdit,
  isDirty,
  isDisabled,
  isSaving,
  isSaved,
  errorMessage,
  onNameChange,
  onDescriptionChange,
  onSave,
  onReload,
}: Readonly<IProjectMetadataEditorProps>) {
  return (
    <form
      className="grid gap-5 rounded-xl border border-border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          name="name"
          maxLength={100}
          required
          disabled={!canEdit || isDisabled || isSaving}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          maxLength={2000}
          disabled={!canEdit || isDisabled || isSaving}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </div>

      {errorMessage && (
        <div role="alert" className="grid gap-2">
          <p>{errorMessage}</p>
          <div>
            <Button type="button" variant="outline" onClick={onReload}>
              Reload latest version
            </Button>
          </div>
        </div>
      )}
      {isSaved && (
        <p role="status" aria-live="polite">
          Project saved.
        </p>
      )}
      <div>
        <Button
          type="submit"
          disabled={!canEdit || !isDirty || isDisabled || isSaving}
        >
          {isSaving ? "Saving…" : "Save project"}
        </Button>
      </div>
    </form>
  );
}

export default ProjectMetadataEditor;
