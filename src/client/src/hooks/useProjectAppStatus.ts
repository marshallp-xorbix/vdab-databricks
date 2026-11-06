import { useProjectDeployments } from "./useProjectDeployments";
import { useWorkspaceAppLifecycle } from "./useWorkspaceAppLifecycle";
import { getDatabricksComputeStatePresentation, readWorkspaceAppStatus } from "../utils/workspaceAppStatus";

/** Joins the saved child-App link with its current workspace lifecycle state. */
export function useProjectAppStatus(projectId: string) {
  const deploymentsQuery = useProjectDeployments(projectId);
  const childApp = deploymentsQuery.data?.childApp;
  const { appQuery } = useWorkspaceAppLifecycle(childApp?.appName);
  const app = appQuery.data;
  const lifecycleStatus = readWorkspaceAppStatus(app);
  const isOnline = lifecycleStatus === "Running";
  const status = deploymentsQuery.isPending
    ? "Checking"
    : deploymentsQuery.isError || appQuery.isError
      ? "Error"
      : !childApp
        ? "Draft"
        : app?.computeState
          ? getDatabricksComputeStatePresentation(app.computeState).shortLabel
          : isOnline
            ? "Online"
            : lifecycleStatus;
  return { childApp, app, isOnline, status };
}
