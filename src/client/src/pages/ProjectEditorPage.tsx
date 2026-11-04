import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import ProjectEditorUnsavedChangesDialog from "../components/ProjectEditorUnsavedChangesDialog";
import ProjectEditorToolbar from "../components/ProjectEditorToolbar";
import ProjectEditorSettingsSection from "../components/ProjectEditorSettingsSection";
import ProjectEditorComponentsSection from "../components/ProjectEditorComponentsSection";
import ProjectEditorWorkflowSection from "../components/ProjectEditorWorkflowSection";
import ProjectGeneratedCodeEditor from "../components/ProjectGeneratedCodeEditor";
import { useProjectEditor } from "../hooks/useProjectEditor";
import { useCallback, useState } from "react";
import { ComponentRegistryProvider } from "../context/ComponentRegistryContext";
import { useProjectDeployments } from "../hooks/useProjectDeployments";

interface IProjectEditorPageProps {
  title?: string;
}

/** Reopens a project and saves its metadata with version conflict protection. */
function ProjectEditorPage({
  title = "App Builder",
}: Readonly<IProjectEditorPageProps>) {
  const editor = useProjectEditor();
  const projectDeploymentsQuery = useProjectDeployments(editor.project?.id);
  const [customModulesState, setCustomModulesState] = useState({
    projectId: "",
    source: null as string | null,
  });
  const {
    projectQuery,
    updateProjectMutation,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    activeEditorSection,
    isCustomModulesDirty,
    setCustomModulesDirty,
    project,
    canEdit,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    previewMutation,
    navigationBlocker,
    handleSave,
    handleSaveCanvas,
    isCanvasSaving,
    handleSaveWorkflow,
    handlePreview,
  } = editor;
  const hasLoadedCustomModulesSource =
    customModulesState.projectId === project?.id &&
    customModulesState.source !== null;
  const customModulesSource = hasLoadedCustomModulesSource
    ? (customModulesState.source ?? "")
    : "";

  const handleCustomModulesSourceChange = useCallback(
    (source: string) => {
      if (!project) return;
      setCustomModulesState({ projectId: project.id, source });
    },
    [project],
  );

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

  const isActiveSectionDirty =
    activeEditorSection === "components"
      ? (isMetadataDirty || isComponentsDirty || isWorkflowDirty) &&
        !isCustomModulesDirty
      : activeEditorSection === "workflows"
        ? isWorkflowDirty
        : activeEditorSection === "settings"
          ? isMetadataDirty
          : false;

  async function handleSaveActiveSection() {
    if (activeEditorSection === "components") {
      await handleSaveCanvas();
      return;
    }
    if (activeEditorSection === "workflows") {
      await handleSaveWorkflow();
      return;
    }
    await handleSave();
  }

  const builderActions = (
    <ProjectEditorToolbar
      projectId={project.id}
      appName={projectDeploymentsQuery.data?.childApp?.appName}
      canEdit={canEdit}
      canSave={isActiveSectionDirty}
      isSaving={
        isCanvasSaving ||
        updateProjectMutation.isPending ||
        replaceComponentsMutation.isPending ||
        replaceWorkflowMutation.isPending
      }
      onSave={handleSaveActiveSection}
      onRefresh={() => {
        void Promise.all([
          projectQuery.refetch(),
          editor.componentsQuery.refetch(),
          editor.workflowQuery.refetch(),
          editor.registryQuery.refetch(),
        ]);
      }}
    />
  );

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <h1 className="sr-only">{project.name || title}</h1>

      {activeEditorSection !== "components" && builderActions}

      <div
        className={`min-h-0 flex-1 bg-card ${activeEditorSection === "settings" ? "overflow-auto" : "overflow-hidden"}`}
      >
        {!canEdit && (
          <p
            role="status"
            className="mb-3 rounded-md border border-border p-3 text-sm"
          >
            You have read-only access to this project.
          </p>
        )}
        <ComponentRegistryProvider>
          <ProjectEditorComponentsSection
            isActive={activeEditorSection === "components"}
            toolbar={builderActions}
            editor={editor}
          />
        </ComponentRegistryProvider>

        <ProjectEditorWorkflowSection
          isActive={activeEditorSection === "workflows"}
          projectId={project.id}
          editor={editor}
          customModulesSource={customModulesSource}
          hasLoadedCustomModulesSource={hasLoadedCustomModulesSource}
          onCustomModulesSourceChange={handleCustomModulesSourceChange}
        />

        {activeEditorSection === "code" && (
          <ProjectGeneratedCodeEditor
            projectId={project.id}
            preview={previewMutation.data ?? null}
            isPending={previewMutation.isPending}
            errorMessage={
              previewMutation.isError
                ? previewMutation.error instanceof Error
                  ? previewMutation.error.message
                  : "The generated code preview could not be created."
                : null
            }
            isDisabled={
              !canEdit ||
              isMetadataDirty ||
              updateProjectMutation.isPending ||
              replaceWorkflowMutation.isPending
            }
            onGenerate={() => void handlePreview()}
            onCustomModulesDirtyChange={setCustomModulesDirty}
            customModulesSource={customModulesSource}
            hasLoadedCustomModulesSource={hasLoadedCustomModulesSource}
            onCustomModulesSourceChange={handleCustomModulesSourceChange}
          />
        )}

        {activeEditorSection === "settings" && (
          <ProjectEditorSettingsSection
            editor={editor}
            childAppName={projectDeploymentsQuery.data?.childApp?.appName}
          />
        )}
      </div>

      <ProjectEditorUnsavedChangesDialog
        isOpen={navigationBlocker.state === "blocked"}
        onKeepEditing={() => navigationBlocker.reset?.()}
        onDiscard={() => navigationBlocker.proceed?.()}
      />
    </main>
  );
}

export default ProjectEditorPage;
