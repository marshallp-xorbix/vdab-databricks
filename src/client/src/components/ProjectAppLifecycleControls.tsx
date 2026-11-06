import { Circle, Loader2, Play, Square } from "lucide-react";
import { useWorkspaceAppLifecycle } from "../hooks/useWorkspaceAppLifecycle";
import { toast } from "./ui/use-toast";
import { Button } from "./ui/button";
import { getDatabricksComputeStatePresentation, readWorkspaceAppStatus } from "../utils/workspaceAppStatus";

interface IProjectAppLifecycleControlsProps {
  appName: string | undefined;
  canEdit: boolean;
}

/** Shows and controls the linked Streamlit child App lifecycle. */
function ProjectAppLifecycleControls({
  appName,
  canEdit,
}: Readonly<IProjectAppLifecycleControlsProps>) {
  const { appQuery, actionMutation } = useWorkspaceAppLifecycle(appName);
  const app = appQuery.data;
  const isActive =
    app?.computeState === "ACTIVE" || app?.appState === "RUNNING";
  const isStopped =
    app?.computeState === "STOPPED" || app?.appState === "UNAVAILABLE";
  const isTransitioning =
    app?.computeState === "STARTING" ||
    app?.computeState === "STOPPING" ||
    app?.computeState === "UPDATING" ||
    app?.appState === "DEPLOYING";
  const action = isActive ? "stop" : "start";
  const presentation = app?.computeState
    ? getDatabricksComputeStatePresentation(app.computeState)
    : null;
  const statusLabel = !appName
    ? "Draft"
    : appQuery.isError
      ? "Error"
      : presentation?.shortLabel ?? readWorkspaceAppStatus(app);

  async function handleAction() {
    try {
      await actionMutation.mutateAsync(action);
    } catch (error) {
      toast({
        title: "App action failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to update the child App.",
        variant: "destructive",
      });
    }
  }

  const isDisabled =
    !appName ||
    !canEdit ||
    appQuery.isPending ||
    appQuery.isError ||
    actionMutation.isPending ||
    isTransitioning ||
    (!isActive && !isStopped);

  return (
    <div className="flex shrink-0 items-center gap-2 border-l border-[var(--builder-chrome-border)] pl-2">
      {app?.url && app.appState === "RUNNING" && (
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={app.url} target="_blank" rel="noopener noreferrer">
            Open app
          </a>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => void handleAction()}
        disabled={isDisabled}
        aria-label={isActive ? "Stop app" : "Start app"}
        className="h-auto px-2.5 py-1 text-xs font-semibold"
      >
        {actionMutation.isPending || isTransitioning ? (
          <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
        ) : isActive ? (
          <Square aria-hidden="true" className="mr-1.5 h-4 w-4" />
        ) : (
          <Play aria-hidden="true" className="mr-1.5 h-4 w-4" />
        )}
        {isActive ? "Stop app" : "Start app"}
      </Button>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--builder-chrome-border)] bg-card px-2.5 py-0.5 text-xs font-semibold"
        role="status"
        aria-live="polite"
        title={presentation?.statusLabel ?? statusLabel}
      >
        <Circle
          aria-hidden="true"
          className={`h-2 w-2 fill-current ${presentation?.dotColorClass ?? "text-muted-foreground"} ${presentation?.dotPulse ? "animate-pulse" : ""} ${presentation?.labelTextClass ?? ""}`}
        />
        <span className={presentation?.labelTextClass}>{statusLabel}</span>
      </span>
    </div>
  );
}

export default ProjectAppLifecycleControls;
