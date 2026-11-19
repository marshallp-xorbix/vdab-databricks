import type { ProjectChildAppMode } from "../models/ProjectDeployments";
import { useProjectDeployments } from "./useProjectDeployments";
import { useWorkspaceAppLifecycle } from "./useWorkspaceAppLifecycle";
import {
  getDatabricksComputeStatePresentation,
  readWorkspaceAppStatus,
} from "../utils/workspaceAppStatus";

export interface ProjectAppStatusTarget {
  appName: string;
  mode: ProjectChildAppMode;
}

/** Joins the saved child-App link with its current workspace lifecycle state. */
export function useProjectAppStatus(
  projectId: string,
  target?: ProjectAppStatusTarget | null,
) {
  const deploymentsQuery = useProjectDeployments(projectId, {
    pollWhileUnlinked: Boolean(target?.appName),
  });
  const childApp = deploymentsQuery.data?.childApp ?? undefined;
  const appName = childApp?.appName ?? target?.appName;
  const expectProvisioning =
    Boolean(appName) &&
    !childApp &&
    (target?.mode === "createNew" || deploymentsQuery.isFetching);
  const { appQuery } = useWorkspaceAppLifecycle(appName, { expectProvisioning });
  const app = appQuery.data;
  const lifecycleStatus = readWorkspaceAppStatus(app);
  const isOnline = lifecycleStatus === "Running";
  const status = resolveStatus({
    deploymentsPending: deploymentsQuery.isPending,
    deploymentsError: deploymentsQuery.isError,
    appError: appQuery.isError,
    appPending: appQuery.isPending,
    childApp: Boolean(childApp),
    targetMode: target?.mode,
    hasAppName: Boolean(appName),
    computeState: app?.computeState,
    isOnline,
    lifecycleStatus,
  });
  return { childApp, app, isOnline, status };
}

function resolveStatus(input: {
  deploymentsPending: boolean;
  deploymentsError: boolean;
  appError: boolean;
  appPending: boolean;
  childApp: boolean;
  targetMode: ProjectChildAppMode | undefined;
  hasAppName: boolean;
  computeState: string | undefined;
  isOnline: boolean;
  lifecycleStatus: string;
}): string {
  if (input.deploymentsPending && !input.hasAppName) return "Checking";
  if (input.deploymentsError && !input.hasAppName) return "Error";
  if (!input.childApp && !input.hasAppName) return "Draft";
  if (input.computeState) {
    return getDatabricksComputeStatePresentation(input.computeState).shortLabel;
  }
  if (input.isOnline) return "Online";
  if (input.targetMode === "createNew" && (input.appPending || input.appError || !input.childApp)) {
    return "Starting";
  }
  if (input.appPending) return "Checking";
  if (input.appError) return "Error";
  return input.lifecycleStatus;
}
