import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import ProjectDeploymentHistoryItem from "./ProjectDeploymentHistoryItem";
import ProjectDeploymentSecretResourcesEditor from "./ProjectDeploymentSecretResourcesEditor";
import ProjectDeploymentReadiness from "./ProjectDeploymentReadiness";
import ProjectDeploymentTargetSelector from "./ProjectDeploymentTargetSelector";
import ProjectDeploymentTargetStatus from "./ProjectDeploymentTargetStatus";
import { useProjectDeploymentReadiness } from "../hooks/useProjectDeploymentReadiness";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useStartProjectDeployment } from "../hooks/useStartProjectDeployment";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";
import { useWorkspaceApps } from "../hooks/useWorkspaceApps";
import { getProjectDeploymentEligibility } from "../utils/projectDeploymentEligibility";
import type {
  IWorkspaceSecretResourceSelection,
  ProjectChildAppMode,
} from "../models/ProjectDeployments";

interface IProjectDeploymentPanelProps {
  projectId: string;
  canEdit: boolean | undefined;
  hasUnsavedChanges: boolean;
}

/** Deploys saved project snapshots as isolated Streamlit child Apps. */
function ProjectDeploymentPanel({
  projectId,
  canEdit,
  hasUnsavedChanges,
}: Readonly<IProjectDeploymentPanelProps>) {
  const historyQuery = useProjectDeployments(projectId);
  const readinessQuery = useProjectDeploymentReadiness(
    canEdit ? projectId : undefined,
  );
  const { refetch: refetchReadiness } = readinessQuery;
  const childApp = historyQuery.data?.childApp ?? null;
  const [mode, setMode] = useState<ProjectChildAppMode>(
    childApp?.mode ?? "createNew",
  );
  const [newAppName, setNewAppName] = useState("");
  const [selectedAppName, setSelectedAppName] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [secretResources, setSecretResources] = useState<
    IWorkspaceSecretResourceSelection[]
  >([]);
  const hadUnsavedChanges = useRef(hasUnsavedChanges);
  const startMutation = useStartProjectDeployment();
  const workspaceAppsQuery = useWorkspaceApps(
    Boolean(canEdit && mode === "linkExisting" && !childApp),
  );
  const availableApps = useMemo(
    () => workspaceAppsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [workspaceAppsQuery.data],
  );
  const appName =
    childApp?.appName ??
    (mode === "linkExisting" ? selectedAppName : newAppName);
  const targetQuery = useWorkspaceAppDeploymentTarget(
    canEdit ? appName || undefined : undefined,
  );
  const target = targetQuery.data ?? null;
  const isLinkedTarget = Boolean(childApp) || mode === "linkExisting";
  const eligibility = getProjectDeploymentEligibility({
    appName,
    canEdit,
    hasUnsavedChanges,
    isLinkedTarget,
    confirmOverwrite,
    isPending: startMutation.isPending,
    readiness: readinessQuery.data,
    readinessIsError: readinessQuery.isError,
    target,
    targetIsPending: targetQuery.isPending,
    targetIsError: targetQuery.isError,
    secretResources,
  });
  const latestRecord = historyQuery.data?.items[0] ?? null;
  const latestSuccessful =
    historyQuery.data?.items.find((item) => item.status === "succeeded") ??
    null;
  const needsRestore = Boolean(
    latestRecord &&
    (latestRecord.status === "failed" || latestRecord.status === "cancelled") &&
    latestSuccessful,
  );
  useEffect(() => {
    if (hadUnsavedChanges.current && !hasUnsavedChanges)
      void refetchReadiness();
    hadUnsavedChanges.current = hasUnsavedChanges;
  }, [hasUnsavedChanges, refetchReadiness]);

  useEffect(() => {
    setSecretResources([]);
  }, [mode, appName]);

  async function handleStart() {
    if (!eligibility.canStart) return;
    try {
      await startMutation.mutateAsync({
        projectId,
        mode: childApp?.mode ?? mode,
        appName,
        confirmOverwrite: isLinkedTarget ? confirmOverwrite : false,
        secretResources,
      });
      setConfirmOverwrite(false);
      setSelectedAppName("");
    } catch {
      // The deployment history and sanitized mutation error show the outcome.
    }
  }

  return (
    <section
      id="project-deployment"
      aria-labelledby="project-deployment-heading"
      className="space-y-5 rounded-xl border border-border bg-card p-6"
    >
      <header>
        <h2 id="project-deployment-heading" className="text-lg font-semibold">
          Child App deployment
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deploys the saved project version to a Python Streamlit App in this
          workspace. Databricks checks your own App and resource permissions.
        </p>
      </header>

      {historyQuery.isPending && (
        <p role="status" aria-live="polite">
          Loading deployment history…
        </p>
      )}
      {historyQuery.isError && (
        <div role="alert" className="space-y-2">
          <p>
            {historyQuery.error instanceof Error
              ? historyQuery.error.message
              : "Deployment history could not be loaded."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void historyQuery.refetch()}
          >
            Retry loading history
          </Button>
        </div>
      )}

      {canEdit && !childApp && (
        <ProjectDeploymentTargetSelector
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setConfirmOverwrite(false);
          }}
          newAppName={newAppName}
          onNewAppNameChange={setNewAppName}
          selectedAppName={selectedAppName}
          onSelectedAppNameChange={(name) => {
            setSelectedAppName(name);
            setConfirmOverwrite(false);
          }}
          availableApps={availableApps}
          isAppsPending={workspaceAppsQuery.isPending}
          isAppsError={workspaceAppsQuery.isError}
          appsErrorMessage={
            workspaceAppsQuery.error instanceof Error
              ? workspaceAppsQuery.error.message
              : "Workspace Apps could not be loaded."
          }
          hasNextPage={Boolean(workspaceAppsQuery.hasNextPage)}
          isFetchingNextPage={workspaceAppsQuery.isFetchingNextPage}
          onFetchNextPage={() => void workspaceAppsQuery.fetchNextPage()}
        />
      )}

      <ProjectDeploymentTargetStatus
        childApp={childApp}
        appName={appName}
        mode={mode}
        target={target}
        isTargetPending={targetQuery.isPending}
        isTargetError={targetQuery.isError}
        targetErrorMessage={
          targetQuery.error instanceof Error
            ? targetQuery.error.message
            : "App details could not be loaded."
        }
        missingScopes={eligibility.missingScopes}
      />

      {canEdit && !hasUnsavedChanges && (
        <ProjectDeploymentSecretResourcesEditor
          allowCreate={!isLinkedTarget}
          target={target}
          selections={secretResources}
          onChange={setSecretResources}
        />
      )}

      <ProjectDeploymentReadiness
        readiness={readinessQuery.data}
        isPending={readinessQuery.isPending}
        isError={readinessQuery.isError}
        errorMessage={
          readinessQuery.error instanceof Error
            ? readinessQuery.error.message
            : "Project deployment requirements could not be checked."
        }
      />

      {hasUnsavedChanges && (
        <p role="status">
          Save all project edits before deploying. Deployments always use the
          saved version.
        </p>
      )}
      {!canEdit && (
        <p role="status">
          You have read-only access and cannot deploy this project's child App.
        </p>
      )}

      {canEdit && !hasUnsavedChanges && (
        <div className="space-y-3">
          {isLinkedTarget && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={confirmOverwrite}
                onChange={(event) => setConfirmOverwrite(event.target.checked)}
              />
              <span>
                I confirm that deploying will replace the current source for App{" "}
                <strong>{appName || "(select an App)"}</strong>.
              </span>
            </label>
          )}
          <Button
            type="button"
            disabled={!eligibility.canStart}
            onClick={() => void handleStart()}
          >
            {startMutation.isPending
              ? "Submitting deployment…"
              : childApp
                ? "Deploy saved version"
                : mode === "createNew"
                  ? "Create and deploy App"
                  : "Link and deploy App"}
          </Button>
        </div>
      )}

      {startMutation.isError && (
        <p role="alert">
          {startMutation.error instanceof Error
            ? startMutation.error.message
            : "Deployment could not be submitted."}
        </p>
      )}

      {historyQuery.data && (
        <div className="space-y-3">
          <h3 className="font-medium">Deployment history</h3>
          {historyQuery.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deployment attempts yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {[...historyQuery.data.items]
                .sort(
                  (first, second) =>
                    Date.parse(second.createdAt) - Date.parse(first.createdAt),
                )
                .map((deployment) => (
                  <ProjectDeploymentHistoryItem
                    key={deployment.id}
                    projectId={projectId}
                    deployment={deployment}
                    canEdit={canEdit}
                    canRestore={Boolean(
                      needsRestore && latestSuccessful?.id === deployment.id,
                    )}
                  />
                ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

export default ProjectDeploymentPanel;
