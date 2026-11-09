import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import ProjectEditorUnsavedChangesDialog from "../components/ProjectEditorUnsavedChangesDialog";
import ProjectEditorToolbar from "../components/ProjectEditorToolbar";
import ProjectEditorSettingsSection from "../components/ProjectEditorSettingsSection";
import ProjectEditorComponentsSection from "../components/ProjectEditorComponentsSection";
import ProjectEditorWorkflowSection from "../components/ProjectEditorWorkflowSection";
import ProjectGeneratedCodeEditor from "../components/ProjectGeneratedCodeEditor";
import AiBuilderPanel from "../components/AiBuilderPanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../components/ui/sheet";
import { useProjectEditor } from "../hooks/useProjectEditor";
import { useCallback, useEffect, useState } from "react";
import { ComponentRegistryProvider } from "../context/ComponentRegistryContext";
import { BuilderLayoutProvider } from "../context/BuilderLayoutContext";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useProjectCustomModules } from "../hooks/useProjectCustomModules";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";

interface IProjectEditorPageProps {
  title?: string;
}

/** Reopens a project and saves its metadata with version conflict protection. */
function ProjectEditorPage({
  title = "App Builder",
}: Readonly<IProjectEditorPageProps>) {
  return (
    <BuilderLayoutProvider>
      <ProjectEditorPageContent title={title} />
    </BuilderLayoutProvider>
  );
}

function ProjectEditorPageContent({
  title = "App Builder",
}: Readonly<IProjectEditorPageProps>) {
  const editor = useProjectEditor();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectDeploymentsQuery = useProjectDeployments(editor.project?.id);
  const customModulesQuery = useProjectCustomModules(editor.project?.id);
  const servingEndpointsQuery = useWorkspaceServingEndpoints();
  const [showAiChat, setShowAiChat] = useState(false);
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

  useEffect(() => {
    if (searchParams.get("tool") !== "ai") return;
    setShowAiChat(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("tool");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const document = customModulesQuery.data;
    if (
      document &&
      project &&
      document.projectId === project.id &&
      !hasLoadedCustomModulesSource
    ) {
      handleCustomModulesSourceChange(document.source);
    }
  }, [
    customModulesQuery.data,
    handleCustomModulesSourceChange,
    hasLoadedCustomModulesSource,
    project,
  ]);

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

  async function handleSaveActiveSection(): Promise<boolean> {
    if (activeEditorSection === "components") return handleSaveCanvas();
    if (activeEditorSection === "workflows") return handleSaveWorkflow();
    return handleSave();
  }

  const builderActions = (
    <ProjectEditorToolbar
      projectId={project.id}
      appName={projectDeploymentsQuery.data?.childApp?.appName}
      canEdit={canEdit}
      canSave={canEdit}
      isSaving={
        isCanvasSaving ||
        updateProjectMutation.isPending ||
        replaceComponentsMutation.isPending ||
        replaceWorkflowMutation.isPending
      }
      hasUnsavedChanges={editor.isDirty || isActiveSectionDirty}
      isCustomModulesDirty={isCustomModulesDirty}
      deploymentSettings={editor.deploymentSettings}
      components={editor.components}
      isAiOpen={showAiChat}
      onToggleAi={() => setShowAiChat((open) => !open)}
      onSaveForDeploy={handleSaveCanvas}
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
            customModulesSource={customModulesSource}
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

      <Sheet
        modal={false}
        open={showAiChat}
        onOpenChange={(isOpen) => {
          if (!isOpen) setShowAiChat(false);
        }}
      >
        <SheetContent
          side="right"
          overlayClassName="pointer-events-none"
          className="!inset-y-auto !top-auto !right-4 !bottom-4 !h-[70vh] !w-96 !max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-2 border-primary bg-card p-0 shadow-xl sm:!max-w-96 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">AI Builder</SheetTitle>
          <SheetDescription className="sr-only">
            Request a project change using a workspace serving endpoint.
          </SheetDescription>
          <div className="flex min-h-0 flex-1">
            {customModulesQuery.isPending && (
              <p role="status" className="p-3 text-sm">
                Loading custom modules…
              </p>
            )}
            {customModulesQuery.isError && (
              <p role="alert" className="p-3 text-sm text-destructive">
                {customModulesQuery.error instanceof Error
                  ? customModulesQuery.error.message
                  : "Custom Python modules could not be loaded."}
              </p>
            )}
            {servingEndpointsQuery.isError && (
              <p role="alert" className="p-3 text-sm text-destructive">
                {servingEndpointsQuery.error instanceof Error
                  ? servingEndpointsQuery.error.message
                  : "Serving endpoints could not be loaded for AI Builder."}
              </p>
            )}
            {customModulesQuery.data && (
              <AiBuilderPanel
                projectId={project.id}
                version={
                  editor.componentsDocument?.version ??
                  editor.workflowDocument?.version ??
                  project.version
                }
                endpoints={servingEndpointsQuery.data?.items ?? []}
                endpointsLoading={servingEndpointsQuery.isPending}
                components={editor.components}
                workflow={editor.workflow}
                customModulesSource={
                  customModulesSource || customModulesQuery.data.source
                }
                isDisabled={
                  !canEdit ||
                  customModulesQuery.isPending ||
                  servingEndpointsQuery.isError
                }
                onClose={() => setShowAiChat(false)}
                onApplyProposal={(proposal) => {
                  editor.handleComponentsChange(proposal.components);
                  editor.setWorkflow(proposal.workflow);
                  if (
                    proposal.customModulesSource !==
                    customModulesQuery.data.source
                  ) {
                    handleCustomModulesSourceChange(proposal.customModulesSource);
                  }
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ProjectEditorUnsavedChangesDialog
        isOpen={navigationBlocker.state === "blocked"}
        onKeepEditing={() => navigationBlocker.reset?.()}
        onDiscard={() => navigationBlocker.proceed?.()}
      />
    </main>
  );
}

export default ProjectEditorPage;
