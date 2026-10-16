import { useCallback, useEffect, useRef, useState, type FC } from "react";
import {
  Bot,
  Check,
  CloudUpload,
  Loader2,
  PanelLeft,
  PanelRight,
  Play,
  RefreshCcw,
  Save,
  Square,
  X,
} from "lucide-react";
import type { AppStatusResponse } from "../../models";
import { appActionApi } from "../../providers/AppActionApi";
import { AppActionRouteSegment } from "../../types/appActionApiRoutes";
import { toast } from "../ui/use-toast";
import { showAuthFailureToast } from "../../utils/authToast";
import { useDatabricksWorkspaceAuth } from "../../hooks/useDatabricksWorkspaceAuth";
import { useAppDeployment } from "../../hooks/useAppDeployment";
import { Button } from "../ui/button";
import type { VdabComponent } from "../../types/components";
import type { WorkflowDefinition } from "../../types/workflow";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import { getComputeStatusPresentation } from "./builderHeaderComputeStatus";
import { ComputeStatusPill } from "./computeStatusDisplay";
import { useLogger } from "../../logger/useLogger";

interface BuilderHeaderProps {
  appId?: number | null;
  components: VdabComponent[];
  workflowDefinition: WorkflowDefinition;
  onSave?: () => Promise<void>;
  /** When true, Save is disabled (e.g. invalid dashboard embed URL). */
  saveDisabled?: boolean;
  /** Shown as the Save button tooltip when save is disabled. */
  saveDisabledReason?: string;
  onAiBuilderClick?: () => void;
  onReload?: () => void;
  /** App Settings resources for Genie Chat deploy/preview validation. */
  normalizedAppResources?: NormalizedAppResource[];
  onToggleLeftPanel?: () => void;
  isLeftPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  isRightPanelOpen?: boolean;
}

const BuilderHeader: FC<BuilderHeaderProps> = ({
  appId,
  components,
  workflowDefinition,
  onSave,
  saveDisabled = false,
  saveDisabledReason,
  onAiBuilderClick,
  onReload,
  normalizedAppResources = [],
  onToggleLeftPanel,
  isLeftPanelOpen = true,
  onToggleRightPanel,
  isRightPanelOpen = true,
}) => {
  const logger = useLogger("BuilderHeader");
  const isMountedRef = useRef(true);
  const lastKnownStateRef = useRef<string>("");
  const isFetchingStatusRef = useRef(false);
  const lastStatusFetchAtRef = useRef(0);
  const [appStatus, setAppStatus] = useState<AppStatusResponse | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isComputeUnavailable, setIsComputeUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const handleAuthenticate = useDatabricksWorkspaceAuth(appId);

  // Only show view mode toggle for page/modal tabs (not Main Flow)
  const canReload = Boolean(onReload);
  const computeState = (appStatus?.state || "").trim().toUpperCase();
  const effectiveState = computeState || lastKnownStateRef.current;
  const isRunning = effectiveState === "ACTIVE";
  const isPending = ["STARTING", "STOPPING", "UPDATING", "DELETING"].includes(
    effectiveState,
  );
  const isAwaitingInitialStatus =
    Boolean(appId) && !isComputeUnavailable && appStatus === null;
  const isBusy = isStatusLoading || isActionLoading;
  const canToggleApp =
    Boolean(appId) &&
    !isBusy &&
    !isPending &&
    !isComputeUnavailable &&
    !isAwaitingInitialStatus;
  const computePresentation = getComputeStatusPresentation({
    appId,
    isComputeUnavailable,
    isAwaitingInitialStatus,
    effectiveState,
  });

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      await onSave();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      logger.UI.error("Save failed:", error);
      toast({
        title: "Save failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to save app changes.",
        variant: "destructive",
      });
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleSaveStart = useCallback(() => {
    setSaving(true);
    setSaveStatus("idle");
  }, []);
  const handleSaveSuccess = useCallback(() => {
    setSaveStatus("success");
    setTimeout(() => setSaveStatus("idle"), 2000);
    setSaving(false);
  }, []);
  const handleSaveError = useCallback(() => {
    setSaveStatus("error");
    setTimeout(() => setSaveStatus("idle"), 3000);
    setSaving(false);
  }, []);

  const { handleDeployApp, isDeploying, appWorkspacePath } = useAppDeployment({
    formComponents: components,
    workflowDefinition,
    appId: appId?.toString(),
    normalizedAppResources,
    onSave,
    onSaveStart: handleSaveStart,
    onSaveSuccess: handleSaveSuccess,
    onSaveError: handleSaveError,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (computeState) {
      lastKnownStateRef.current = computeState;
    }
  }, [computeState]);

  const fetchAppStatus = useCallback(
    async (showErrorToast: boolean) => {
      if (!appId) {
        logger.UI.log("[BuilderHeader] Skipping status fetch (missing appId)");
        return;
      }

      if (isFetchingStatusRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastStatusFetchAtRef.current < 1000) {
        return;
      }

      isFetchingStatusRef.current = true;

      if (isMountedRef.current) {
        setIsStatusLoading(true);
      }
      try {
        const response = await appActionApi.getAppStatus(appId);
        logger.UI.log("[BuilderHeader] App status response", {
          appId,
          response,
        });
        if (isMountedRef.current) {
          setAppStatus(response);
          setIsComputeUnavailable(false);
        }
      } catch (error) {
        logger.UI.error("Failed to fetch app status", error);
        if (isMountedRef.current) {
          setIsComputeUnavailable(true);
        }
        if (showErrorToast && isMountedRef.current) {
          const handled = showAuthFailureToast(
            error,
            "App status error",
            "Unable to fetch app status.",
            handleAuthenticate,
          );

          if (!handled) {
            toast({
              title: "App status error",
              description:
                error instanceof Error
                  ? error.message
                  : "Unable to fetch app status.",
              variant: "destructive",
            });
          }
        }
      } finally {
        lastStatusFetchAtRef.current = Date.now();
        isFetchingStatusRef.current = false;
        if (isMountedRef.current) {
          setIsStatusLoading(false);
        }
      }
    },
    [appId, handleAuthenticate],
  );

  useEffect(() => {
    if (!appId) {
      setAppStatus(null);
      lastKnownStateRef.current = "";
      return;
    }

    setAppStatus(null);
    lastKnownStateRef.current = "";
    void fetchAppStatus(true);
  }, [appId, fetchAppStatus]);

  useEffect(() => {
    if (!appId || !isPending) return;

    logger.UI.log("[BuilderHeader] Starting pending status polling", {
      appId,
      computeState,
    });
    const intervalId = window.setInterval(() => {
      void fetchAppStatus(false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appId, computeState, fetchAppStatus, isPending]);

  useEffect(() => {
    if (!appId || isPending) return;

    const intervalId = window.setInterval(() => {
      void fetchAppStatus(false);
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appId, fetchAppStatus, isPending]);

  const handleToggleApp = useCallback(async () => {
    if (!appId) {
      return;
    }

    logger.UI.log("[BuilderHeader] Toggling app state", {
      appId,
      action: isRunning
        ? AppActionRouteSegment.Stop
        : AppActionRouteSegment.Start,
    });
    setIsActionLoading(true);

    try {
      const response = isRunning
        ? await appActionApi.stopApp(appId)
        : await appActionApi.startApp(appId);

      if (isMountedRef.current) {
        setAppStatus(response);
        setIsComputeUnavailable(false);
      }
    } catch (error) {
      logger.UI.error("Failed to toggle app", error);
      if (isMountedRef.current) {
        setIsComputeUnavailable(true);
        const handled = showAuthFailureToast(
          error,
          "App action failed",
          "Unable to start or stop the app.",
          handleAuthenticate,
        );

        if (!handled) {
          toast({
            title: "App action failed",
            description:
              error instanceof Error
                ? error.message
                : "Unable to start or stop the app.",
            variant: "destructive",
          });
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [appId, isRunning, handleAuthenticate, logger]);

  return (
    <div className="builder-chrome-surface builder-chrome-toolbar-row flex items-center border-b border-[var(--builder-chrome-border)] px-2">
      {/* Panel Toggle */}
      {onToggleLeftPanel !== undefined && (
        <button
          type="button"
          onClick={onToggleLeftPanel}
          className="mr-2 flex-shrink-0 rounded p-1.5 text-[var(--builder-chrome-foreground)] transition-colors hover:bg-[var(--builder-chrome-hover)]"
          title={
            isLeftPanelOpen
              ? "Close left builder panel"
              : "Open left builder panel"
          }
          aria-label="Toggle left builder panel"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Right: Actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Prompt / Save / Deploy */}
        {onAiBuilderClick && (
          <Button
            onClick={onAiBuilderClick}
            className="px-3 py-1.5 h-auto text-xs font-semibold flex items-center gap-1 bg-primary text-primary-foreground hover:opacity-90"
          >
            <Bot className="w-3 h-3" />
            <span>Prompt</span>
          </Button>
        )}
        {onSave && (
          <Button
            onClick={handleSave}
            disabled={saving || saveDisabled}
            title={
              saveDisabled && saveDisabledReason
                ? saveDisabledReason
                : undefined
            }
            className="px-3 py-1.5 h-auto text-xs font-semibold flex items-center gap-1 bg-primary text-primary-foreground hover:opacity-90"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saveStatus === "success" && <Check className="w-3 h-3" />}
            {saveStatus === "error" && <X className="w-3 h-3" />}
            {!saving && saveStatus === "idle" && <Save className="w-3 h-3" />}
            <span>
              {saving
                ? "Saving..."
                : saveStatus === "success"
                  ? "Saved"
                  : saveStatus === "error"
                    ? "Error"
                    : "Save"}
            </span>
          </Button>
        )}
        <Button
          onClick={handleDeployApp}
          disabled={isDeploying || !appWorkspacePath}
          variant="outline"
          className="border border-[var(--builder-chrome-border)] text-[var(--builder-chrome-foreground)] bg-card hover:bg-muted px-3 py-1.5 h-auto text-xs font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !appWorkspacePath
              ? "Configure workspace path in app settings first"
              : undefined
          }
        >
          <CloudUpload className="h-3 w-3" />
          <span>{isDeploying ? "Deploying..." : "Deploy"}</span>
        </Button>

        <div className="mx-1 h-5 w-px bg-[var(--builder-chrome-border)]" />

        <button
          type="button"
          onClick={onReload}
          disabled={!canReload}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--builder-chrome-foreground)] transition-colors hover:bg-[var(--builder-chrome-hover)] disabled:pointer-events-none disabled:opacity-50"
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCcw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
        <button
          type="button"
          onClick={handleToggleApp}
          disabled={!canToggleApp}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--builder-chrome-foreground)] transition-colors hover:bg-[var(--builder-chrome-hover)] disabled:pointer-events-none disabled:opacity-50"
          aria-label={computePresentation.toggleAriaLabel}
          title={computePresentation.toggleTitle}
        >
          {isRunning ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>{isRunning ? "Stop" : "Start"}</span>
        </button>
        <ComputeStatusPill presentation={computePresentation} />
        {onToggleRightPanel !== undefined && (
          <button
            type="button"
            onClick={onToggleRightPanel}
            className="ml-1 flex-shrink-0 rounded p-1.5 text-[var(--builder-chrome-foreground)] transition-colors hover:bg-[var(--builder-chrome-hover)]"
            title={
              isRightPanelOpen
                ? "Close right properties panel"
                : "Open right properties panel"
            }
            aria-label="Toggle right builder panel"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default BuilderHeader;
