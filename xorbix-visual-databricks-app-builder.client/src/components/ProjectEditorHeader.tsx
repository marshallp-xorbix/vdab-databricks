import { Link } from "react-router-dom";
import ProjectMetadataEditor from "./ProjectMetadataEditor";

interface IProjectEditorHeaderProps {
  title: string;
  projectName: string;
  projectVersion: number;
  callerRole: string;
  canEdit: boolean;
  name: string;
  description: string;
  isMetadataDirty: boolean;
  isDisabled: boolean;
  isSaving: boolean;
  isSaved: boolean;
  errorMessage: string | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onReload: () => void;
}

/** Renders project identity, access state, and editable metadata. */
function ProjectEditorHeader({
  title,
  projectName,
  projectVersion,
  callerRole,
  canEdit,
  name,
  description,
  isMetadataDirty,
  isDisabled,
  isSaving,
  isSaved,
  errorMessage,
  onNameChange,
  onDescriptionChange,
  onSave,
  onReload,
}: Readonly<IProjectEditorHeaderProps>) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link className="underline-offset-4 hover:underline" to="/apps">
              Projects
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}: {projectName}
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">
          Version {projectVersion} · {callerRole}
        </span>
      </header>

      {!canEdit && (
        <p role="status" className="rounded-md border border-border p-3 text-sm">
          You have read-only access to this project.
        </p>
      )}

      <ProjectMetadataEditor
        name={name}
        description={description}
        canEdit={canEdit}
        isDirty={isMetadataDirty}
        isDisabled={isDisabled}
        isSaving={isSaving}
        isSaved={isSaved}
        errorMessage={errorMessage}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onSave={onSave}
        onReload={onReload}
      />
    </>
  );
}

export default ProjectEditorHeader;
