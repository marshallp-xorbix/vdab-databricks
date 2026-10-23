import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import ProjectEditorHeader from "../components/ProjectEditorHeader";
import ProjectEditorUnsavedChangesDialog from "../components/ProjectEditorUnsavedChangesDialog";
import ProjectCollaboratorsEditor from "../components/ProjectCollaboratorsEditor";
import ProjectDeploymentPanel from "../components/ProjectDeploymentPanel";
import ProjectEditorComponentsSection from "../components/ProjectEditorComponentsSection";
import ProjectEditorWorkflowSection from "../components/ProjectEditorWorkflowSection";
import { useProjectEditor } from "../hooks/useProjectEditor";

interface IProjectEditorPageProps {
  title?: string;
}

/** Reopens a project and saves its metadata with version conflict protection. */
function ProjectEditorPage({
  title = "Project settings",
}: Readonly<IProjectEditorPageProps>) {
  const editor = useProjectEditor();
  const {
    projectQuery,
    updateProjectMutation,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    name,
    setName,
    description,
    setDescription,
    activeEditorSection,
    isCustomModulesDirty,
    project,
    canEdit,
    canManageCollaborators,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isDirty,
    navigationBlocker,
    handleSave,
    handleReloadMetadata,
    handleEditorSectionChange,
  } = editor;

  if (projectQuery.isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <p role="status" aria-live="polite">
          Loading project…
        </p>
      </main>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Project unavailable</h1>
        <p role="alert">
          {projectQuery.error instanceof Error
            ? projectQuery.error.message
            : "The project could not be loaded."}
        </p>
        <Button variant="outline" asChild>
          <Link to="/apps">Back to projects</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <ProjectEditorHeader
        title={title}
        projectName={project.name}
        projectVersion={project.version}
        callerRole={project.callerRole}
        canEdit={canEdit}
        name={name}
        description={description}
        isMetadataDirty={isMetadataDirty}
        isDisabled={
          replaceComponentsMutation.isPending ||
          replaceWorkflowMutation.isPending ||
          isComponentsDirty ||
          isWorkflowDirty ||
          isCustomModulesDirty
        }
        isSaving={updateProjectMutation.isPending}
        isSaved={updateProjectMutation.isSuccess && !isMetadataDirty}
        errorMessage={
          updateProjectMutation.isError
            ? updateProjectMutation.error instanceof Error
              ? updateProjectMutation.error.message
              : "The project could not be saved."
            : null
        }
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSave={() => void handleSave()}
        onReload={() => void handleReloadMetadata()}
      />

      <nav aria-label="Project editor sections" className="flex gap-2">
        <Button
          type="button"
          aria-pressed={activeEditorSection === "components"}
          variant={activeEditorSection === "components" ? "default" : "outline"}
          onClick={() => handleEditorSectionChange("components")}
        >
          App components
        </Button>
        <Button
          type="button"
          aria-pressed={activeEditorSection === "workflows"}
          variant={activeEditorSection === "workflows" ? "default" : "outline"}
          onClick={() => handleEditorSectionChange("workflows")}
        >
          Workflows
        </Button>
        {canManageCollaborators && (
          <Button
            type="button"
            aria-pressed={activeEditorSection === "collaborators"}
            variant={
              activeEditorSection === "collaborators" ? "default" : "outline"
            }
            onClick={() => handleEditorSectionChange("collaborators")}
          >
            Project access
          </Button>
        )}
      </nav>

      {canManageCollaborators && activeEditorSection === "collaborators" && (
        <ProjectCollaboratorsEditor projectId={project.id} />
      )}

      <ProjectEditorComponentsSection
        isActive={activeEditorSection === "components"}
        editor={editor}
      />

      <ProjectEditorWorkflowSection
        isActive={activeEditorSection === "workflows"}
        projectId={project.id}
        editor={editor}
      />

      <ProjectDeploymentPanel
        projectId={project.id}
        canEdit={canEdit}
        hasUnsavedChanges={isDirty}
      />

      <ProjectEditorUnsavedChangesDialog
        isOpen={navigationBlocker.state === "blocked"}
        onKeepEditing={() => navigationBlocker.reset()}
        onDiscard={() => navigationBlocker.proceed()}
      />
    </main>
  );
}

export default ProjectEditorPage;
