import { Link } from "react-router-dom";
import { Bot, CloudUpload, RefreshCcw, Save } from "lucide-react";
import { Button } from "./ui/button";
import ProjectAppLifecycleControls from "./ProjectAppLifecycleControls";

interface IProjectEditorToolbarProps {
  projectId: string;
  appName?: string;
  canEdit: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onRefresh: () => void;
}

/** Shared project actions for the canvas, workflows, code and settings views. */
function ProjectEditorToolbar({
  projectId,
  appName,
  canEdit,
  canSave,
  isSaving,
  onSave,
  onRefresh,
}: Readonly<IProjectEditorToolbarProps>) {
  return (
    <nav
      aria-label="Builder actions"
      className="builder-chrome-surface flex min-h-11 shrink-0 items-center justify-end gap-0 border-b border-[var(--builder-chrome-border)] px-1 2xl:gap-1 2xl:px-3"
    >
      <Button
        size="sm"
        asChild
        className="h-auto bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <Link to={`/apps/${projectId}?tool=ai`}>
          <Bot className="mr-1 h-3.5 w-3.5" />
          Prompt
        </Link>
      </Button>
      <Button
        size="sm"
        disabled={!canEdit || !canSave || isSaving}
        onClick={() => void onSave()}
        className="h-auto bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <Save className="mr-1 h-3 w-3" />
        {isSaving ? "Saving…" : "Save"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        className="h-auto border border-[var(--builder-chrome-border)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-muted"
      >
        <Link
          to={`/apps/${projectId}?section=settings&settings=resources#project-deployment`}
        >
          <CloudUpload className="mr-1 h-3 w-3" />
          Deploy
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        className="inline-flex h-auto items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--builder-chrome-foreground)] hover:bg-[var(--builder-chrome-hover)]"
      >
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      <ProjectAppLifecycleControls appName={appName} canEdit={canEdit} />
    </nav>
  );
}

export default ProjectEditorToolbar;
