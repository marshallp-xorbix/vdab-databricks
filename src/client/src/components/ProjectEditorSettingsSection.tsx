import { useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import ProjectMetadataEditor from "./ProjectMetadataEditor";
import ProjectAccessSettingsSection from "./ProjectAccessSettingsSection";
import ProjectDeploymentPanel from "./ProjectDeploymentPanel";
import ProjectDeploymentSettingsEditor from "./ProjectDeploymentSettingsEditor";
import AppThemeTab from "./AppBuilderComponents/AppSettingsTab/AppThemeTab";
import type { AppThemeColorKey } from "./AppBuilderComponents/AppSettingsTab/themeDefaults";
import SettingsCard from "./AppBuilderComponents/AppSettingsTab/SettingsCard";
import type { useProjectEditor } from "../hooks/useProjectEditor";
import { useProjectAppStatus } from "../hooks/useProjectAppStatus";
import { useWorkspaceSession } from "../hooks/useWorkspaceSession";
import {
  formatProjectDate,
  readSettingsTab,
  readDeploymentMode,
} from "../utils/projectEditorSettings";

interface IProjectEditorSettingsSectionProps {
  editor: ReturnType<typeof useProjectEditor>;
  childAppName?: string;
}

/** Renders persisted app identity, theme, deployment and project access settings. */
function ProjectEditorSettingsSection({
  editor,
  childAppName,
}: Readonly<IProjectEditorSettingsSectionProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const appStatus = useProjectAppStatus(editor.project?.id ?? "");
  const workspaceSession = useWorkspaceSession();
  const {
    project,
    name,
    setName,
    description,
    setDescription,
    theme,
    setTheme,
    deploymentSettings,
    setDeploymentSettings,
    canEdit,
    canManageCollaborators,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isCustomModulesDirty,
    isDirty,
    updateProjectMutation,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    handleSave,
    handleReloadMetadata,
  } = editor;
  const settingsTab = readSettingsTab(searchParams.get("settings"));
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
  if (!project) return null;
  return (
    <div className="flex min-h-full flex-col">
      <nav
        aria-label="App settings"
        className="flex shrink-0 items-end gap-6 border-b border-border bg-card px-5 lg:px-6"
      >
        <h2 className="whitespace-nowrap py-3 text-lg font-semibold">
          App Settings
        </h2>
        <div className="flex flex-wrap">
          {[
            ["details", "App Details"],
            ["theme", "App Theme"],
            ["resources", "Resources"],
            ["permissions", "Permissions"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`px-4 py-3 text-sm font-medium ${settingsTab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => handleSettingsTabChange(id)}
              aria-pressed={settingsTab === id}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div className="flex min-h-0 flex-1 gap-5 px-5 py-4 lg:px-6">
        <div className="min-w-0 flex-1 space-y-5">
          {settingsTab === "theme" && (
            <section className="space-y-4">
              <AppThemeTab
                appTheme={theme as Record<string, string>}
                onThemeColorChange={(key: AppThemeColorKey, value: string) =>
                  setTheme((current) => ({ ...current, [key]: value }))
                }
              />
            </section>
          )}
          {settingsTab === "details" && (
            <>
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
              <ProjectDeploymentSettingsEditor
                settings={deploymentSettings}
                childAppName={childAppName}
                isDisabled={
                  !canEdit ||
                  isComponentsDirty ||
                  isWorkflowDirty ||
                  isCustomModulesDirty ||
                  updateProjectMutation.isPending
                }
                onChange={setDeploymentSettings}
              />
            </>
          )}
          {settingsTab === "resources" && (
            <ProjectDeploymentPanel
              projectId={project.id}
              canEdit={canEdit}
              hasUnsavedChanges={isDirty}
              initialMode={
                project.deploymentSettings?.mode ??
                readDeploymentMode(searchParams.get("deployMode"))
              }
              initialAppName={
                project.deploymentSettings?.appName ??
                searchParams.get("deployAppName") ??
                ""
              }
            />
          )}
          {settingsTab === "permissions" && (
            <>
              <ProjectAccessSettingsSection
                projectId={project.id}
                projectOwnerUserId={project.createdBy}
                canManageCollaborators={canManageCollaborators}
              />
            </>
          )}
        </div>
        <aside className="hidden w-56 shrink-0 space-y-4 sm:block lg:w-64">
          <SettingsCard title="Metadata" padding="sm" as="div">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="mt-0.5 font-medium">
                  {formatProjectDate(project.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last Modified</dt>
                <dd className="mt-0.5 font-medium">
                  {formatProjectDate(project.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Owner</dt>
                <dd className="mt-0.5 truncate font-medium">
                  {project.createdBy === workspaceSession.data?.userId
                    ? (workspaceSession.data.email ??
                      workspaceSession.data.preferredUsername ??
                      project.createdBy)
                    : project.createdBy}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-muted-foreground">Status</dt>
                <dd>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-0.5 text-xs">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-warning"
                    />
                    {appStatus.status}
                  </span>
                </dd>
              </div>
            </dl>
          </SettingsCard>
        </aside>
      </div>
      <footer className="mt-auto flex shrink-0 items-center justify-end gap-3 border-t border-white/40 bg-card/70 px-5 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md lg:px-6">
        <Button
          type="button"
          variant="outline"
          disabled={!isMetadataDirty || updateProjectMutation.isPending}
          onClick={() => void handleReloadMetadata()}
        >
          Discard Changes
        </Button>
        <Button
          type="button"
          disabled={
            !canEdit || !isMetadataDirty || updateProjectMutation.isPending
          }
          onClick={() => void handleSave()}
        >
          {updateProjectMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </footer>
    </div>
  );
}

export default ProjectEditorSettingsSection;
