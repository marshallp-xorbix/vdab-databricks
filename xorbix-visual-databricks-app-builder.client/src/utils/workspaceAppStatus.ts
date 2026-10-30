import type { IWorkspaceAppSummary } from "../models/WorkspaceApp";

/** Distinguishes running application code from compute readiness and transitions. */
export function readWorkspaceAppStatus(
  app: IWorkspaceAppSummary | undefined,
): string {
  const transitions: Record<string, string> = {
    STARTING: "Starting",
    STOPPING: "Stopping",
    UPDATING: "Updating",
  };
  const transition = transitions[app?.computeState ?? ""];
  if (transition) return transition;
  if (app?.appState === "DEPLOYING") return "Deploying";
  if (app?.appState === "RUNNING") return "Running";
  if (app?.computeState === "STOPPED") return "Offline";
  if (app?.computeState === "ACTIVE") return "Ready";
  if (app?.appState === "UNAVAILABLE") return "Offline";
  return "Checking";
}
