import { Link } from "react-router-dom";
import { Bot, CloudUpload, RefreshCcw, Save } from "lucide-react";
import { Button } from "../components/ui/button";
import ProjectMetadataEditor from "../components/ProjectMetadataEditor";
import ProjectEditorUnsavedChangesDialog from "../components/ProjectEditorUnsavedChangesDialog";
import ProjectAccessSettingsSection from "../components/ProjectAccessSettingsSection";
import ProjectDeploymentPanel from "../components/ProjectDeploymentPanel";
import ProjectAppLifecycleControls from "../components/ProjectAppLifecycleControls";
import ProjectEditorComponentsSection from "../components/ProjectEditorComponentsSection";
import ProjectEditorWorkflowSection from "../components/ProjectEditorWorkflowSection";
import ProjectGeneratedCodeEditor from "../components/ProjectGeneratedCodeEditor";
import { useProjectEditor } from "../hooks/useProjectEditor";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppThemeTab from "../components/AppBuilderComponents/AppSettingsTab/AppThemeTab";
import type { AppThemeColorKey } from "../components/AppBuilderComponents/AppSettingsTab/themeDefaults";
import { ComponentRegistryProvider } from "../context/ComponentRegistryContext";
import SettingsCard from "../components/AppBuilderComponents/AppSettingsTab/SettingsCard";
import { useProjectDeployments } from "../hooks/useProjectDeployments";

interface IProjectEditorPageProps {
  title?: string;
}

/** Reopens a project and saves its metadata with version conflict protection. */
function ProjectEditorPage({
  title = "App Builder",
}: Readonly<IProjectEditorPageProps>) {
  const editor = useProjectEditor();
  const [searchParams, setSearchParams] = useSearchParams();
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
    name,
    setName,
    description,
    setDescription,
    theme,
    setTheme,
    activeEditorSection,
    isCustomModulesDirty,
    setCustomModulesDirty,
    project,
    canEdit,
    canManageCollaborators,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isDirty,
    previewMutation,
    navigationBlocker,
    handleSave,
    handleSaveComponents,
    handleSaveWorkflow,
    handleReloadMetadata,
    handlePreview,
  } = editor;
  const settingsTab = readSettingsTab(searchParams.get("settings"));
  const hasLoadedCustomModulesSource =
    customModulesState.projectId === project?.id &&
    customModulesState.source !== null;
  const customModulesSource = hasLoadedCustomModulesSource
    ? customModulesState.source ?? ""
    : "";
  function handleSettingsTabChange(tab: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (tab === "details") next.delete("settings");
        else next.set("settings", tab);
        return next;
      },
      { replace: true },
    );
  }

  const handleCustomModulesSourceChange = useCallback((source: string) => {
    if (!project) return;
    setCustomModulesState({ projectId: project.id, source });
  }, [project]);

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

  const isActiveSectionDirty = activeEditorSection === "components"
    ? isMetadataDirty || (isComponentsDirty && !isWorkflowDirty && !isCustomModulesDirty)
    : activeEditorSection === "workflows"
      ? isWorkflowDirty
      : activeEditorSection === "settings"
        ? isMetadataDirty
        : false;

  async function handleSaveActiveSection() {
    if (activeEditorSection === "components") {
      if (isMetadataDirty) await handleSave();
      if (isComponentsDirty) await handleSaveComponents();
      return;
    }
    if (activeEditorSection === "workflows") {
      await handleSaveWorkflow();
      return;
    }
    await handleSave();
  }

  const builderActions = (
    <nav
      aria-label="Builder actions"
      className="builder-chrome-surface flex min-h-11 shrink-0 items-center justify-end gap-0 border-b border-[var(--builder-chrome-border)] px-1 2xl:gap-1 2xl:px-3"
    >
      <Button
        size="sm"
        asChild
        className="h-auto bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <Link to={`/apps/${project.id}?tool=ai`}>
          <Bot className="mr-1 h-3.5 w-3.5" />
          Prompt
        </Link>
      </Button>
      <Button
        size="sm"
        disabled={!canEdit || !isActiveSectionDirty || updateProjectMutation.isPending || replaceComponentsMutation.isPending || replaceWorkflowMutation.isPending}
        onClick={handleSaveActiveSection}
        className="h-auto bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <Save className="mr-1 h-3 w-3" />
        {updateProjectMutation.isPending ? "Saving…" : "Save"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        className="h-auto border border-[var(--builder-chrome-border)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-muted"
      >
        <Link to={`/apps/${project.id}?section=settings&settings=resources#project-deployment`}>
          <CloudUpload className="mr-1 h-3 w-3" />
          Deploy
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void Promise.all([
            projectQuery.refetch(),
            editor.componentsQuery.refetch(),
            editor.workflowQuery.refetch(),
            editor.registryQuery.refetch(),
          ]);
        }}
        className="inline-flex h-auto items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-[var(--builder-chrome-hover)]"
      >
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      <ProjectAppLifecycleControls
        appName={projectDeploymentsQuery.data?.childApp?.appName}
        canEdit={canEdit}
      />
    </nav>
  );

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <h1 className="sr-only">{project.name || title}</h1>

      {activeEditorSection !== "components" && builderActions}

      <div className={`min-h-0 flex-1 bg-card ${activeEditorSection === "settings" ? "overflow-auto" : "overflow-hidden"}`}>
        {!canEdit && (
          <p role="status" className="mb-3 rounded-md border border-border p-3 text-sm">
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
          isDisabled={!canEdit || isMetadataDirty || updateProjectMutation.isPending || replaceWorkflowMutation.isPending}
          onGenerate={() => void handlePreview()}
          onCustomModulesDirtyChange={setCustomModulesDirty}
          customModulesSource={customModulesSource}
          hasLoadedCustomModulesSource={hasLoadedCustomModulesSource}
          onCustomModulesSourceChange={handleCustomModulesSourceChange}
          />
        )}

        {activeEditorSection === "settings" && (
          <div className="flex min-h-full flex-col">
            <nav aria-label="App settings" className="flex shrink-0 items-end gap-6 border-b border-border bg-card px-5 lg:px-6">
              <h2 className="whitespace-nowrap py-3 text-lg font-semibold">App Settings</h2>
              <div className="flex flex-wrap">
                {[["details", "App Details"], ["theme", "App Theme"], ["resources", "Resources"], ["permissions", "Permissions"]].map(([id, label]) => (
                  <button key={id} type="button" className={`px-4 py-3 text-sm font-medium ${settingsTab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => handleSettingsTabChange(id, searchParams, setSearchParams)} aria-pressed={settingsTab === id}>{label}</button>
                ))}
              </div>
            </nav>
            <div className="flex min-h-0 flex-1 gap-5 px-5 py-4 lg:px-6">
            <div className="min-w-0 flex-1 space-y-5">
            {settingsTab === "theme" && (
              <section className="space-y-4">
                <AppThemeTab appTheme={theme as Record<string, string>} onThemeColorChange={(key: AppThemeColorKey, value: string) => setTheme((current) => ({ ...current, [key]: value }))} />
              </section>
            )}
            {settingsTab === "details" && <>
            <section className="rounded-xl border border-border bg-background p-5">
              <header className="mb-4">
                <h2 className="text-lg font-semibold">App details</h2>
              </header>
              <ProjectMetadataEditor
                name={name}
                description={description}
                canEdit={canEdit}
                isDirty={isMetadataDirty}
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
                showActions={false}
              />
            </section>
            </>}
            {settingsTab === "resources" && (
            <ProjectDeploymentPanel
              projectId={project.id}
              canEdit={canEdit}
              hasUnsavedChanges={isDirty}
              initialMode={readDeploymentMode(searchParams.get("deployMode"))}
              initialAppName={searchParams.get("deployAppName") ?? ""}
            />
            )}
            {settingsTab === "permissions" && <>
            <ProjectAccessSettingsSection
              projectId={project.id}
              projectOwnerUserId={project.createdBy}
              canManageCollaborators={canManageCollaborators}
            />
            </>}
          </div>
          <aside className="hidden w-56 shrink-0 space-y-4 sm:block lg:w-64">
            <SettingsCard title="Metadata" padding="sm" as="div">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="mt-0.5 font-medium">{formatProjectDate(project.createdAt)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Last Modified</dt><dd className="mt-0.5 font-medium">{formatProjectDate(project.updatedAt)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Owner</dt><dd className="mt-0.5 truncate font-medium">{project.createdBy}</dd></div>
                <div><dt className="mb-1 text-xs text-muted-foreground">Status</dt><dd><span className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-0.5 text-xs"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" />Draft</span></dd></div>
              </dl>
            </SettingsCard>
          </aside>
            </div>
            <footer className="mt-auto flex shrink-0 items-center justify-end gap-3 border-t border-white/40 bg-card/70 px-5 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md lg:px-6">
              <Button type="button" variant="outline" disabled={!isMetadataDirty || updateProjectMutation.isPending} onClick={() => void handleReloadMetadata()}>Discard Changes</Button>
              <Button type="button" disabled={!canEdit || !isMetadataDirty || updateProjectMutation.isPending} onClick={() => void handleSave()}>{updateProjectMutation.isPending ? "Saving…" : "Save Changes"}</Button>
            </footer>
          </div>
        )}
      </div>

      <ProjectEditorUnsavedChangesDialog
        isOpen={navigationBlocker.state === "blocked"}
        onKeepEditing={() => navigationBlocker.reset()}
        onDiscard={() => navigationBlocker.proceed()}
      />
    </main>
  );
}

export default ProjectEditorPage;

function formatProjectDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function readSettingsTab(value: string | null): string {
  return value === "theme" || value === "resources" || value === "permissions"
    ? value
    : "details";
}

function readDeploymentMode(value: string | null): "createNew" | "linkExisting" {
  return value === "linkExisting" ? "linkExisting" : "createNew";
}
