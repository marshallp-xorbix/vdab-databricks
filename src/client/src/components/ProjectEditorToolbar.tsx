import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Check, RefreshCcw, Save } from "lucide-react";
import { Button } from "./ui/button";
import ProjectAppLifecycleControls from "./ProjectAppLifecycleControls";
import ProjectDeployButton from "./ProjectDeployButton";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectDeploymentSettings } from "../models/ProjectDeploymentSettings";

interface IProjectEditorToolbarProps {
  projectId: string;
  appName?: string;
  canEdit: boolean;
  canSave: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isCustomModulesDirty: boolean;
  deploymentSettings: IProjectDeploymentSettings | null;
  components: readonly IProjectComponent[];
  onSave: () => Promise<boolean>;
  onSaveForDeploy: () => Promise<boolean>;
  onRefresh: () => void;
}

/** Shared project actions for the canvas, workflows, code and settings views. */
function ProjectEditorToolbar({
  projectId,
  appName,
  canEdit,
  canSave,
  isSaving,
  hasUnsavedChanges,
  isCustomModulesDirty,
  deploymentSettings,
  components,
  onSave,
  onSaveForDeploy,
  onRefresh,
}: Readonly<IProjectEditorToolbarProps>) {
  const [showSaved, setShowSaved] = useState(false);

  async function save(): Promise<void> {
    const saved = await onSave();
    if (!saved) return;
    setShowSaved(true);
    window.setTimeout(() => setShowSaved(false), 1600);
  }

  return (
    <nav
      aria-label="Builder actions"
      className="builder-chrome-surface flex min-h-11 w-full min-w-0 shrink-0 items-center justify-start gap-0 overflow-x-auto border-b border-[var(--builder-chrome-border)] px-1 2xl:justify-end 2xl:gap-1 2xl:px-3"
    >
      <Button
        size="sm"
        asChild
        className="h-auto shrink-0 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <Link to={`/apps/${projectId}?section=workflows&tool=ai`}>
          <Bot className="mr-1 h-3.5 w-3.5" />
          Prompt
        </Link>
      </Button>
      <Button
        size="sm"
        aria-label="Save"
        disabled={!canEdit || !canSave || isSaving}
        onClick={() => void save()}
        className="h-auto shrink-0 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        {showSaved ? <Check className="mr-1 h-3 w-3" /> : <Save className="mr-1 h-3 w-3" />}
        {isSaving ? "Saving…" : showSaved ? "Saved" : "Save"}
      </Button>
      <ProjectDeployButton
        projectId={projectId}
        canEdit={canEdit}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        isCustomModulesDirty={isCustomModulesDirty}
        deploymentSettings={deploymentSettings}
        components={components}
        onSave={onSaveForDeploy}
        className="h-auto shrink-0 border border-[var(--builder-chrome-border)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-muted"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        className="inline-flex h-auto shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-[var(--builder-chrome-hover)]"
      >
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      <ProjectAppLifecycleControls appName={appName} canEdit={canEdit} />
    </nav>
  );
}

export default ProjectEditorToolbar;
