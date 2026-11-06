import type { IWorkspaceAppSummary } from "../models/WorkspaceApp";

export interface DatabricksComputeStatePresentation {
  statusLabel: string;
  shortLabel: string;
  dotColorClass: string;
  labelTextClass: string;
  dotPulse: boolean;
}

/** Maps a Databricks compute state to the shared Apps and header pill. */
export function getDatabricksComputeStatePresentation(
  rawState: string,
): DatabricksComputeStatePresentation {
  const effectiveState = rawState.trim().toUpperCase();
  if (effectiveState === "STARTING") {
    return { statusLabel: "App Compute Starting", shortLabel: "Starting", dotColorClass: "bg-warning", labelTextClass: "text-warning", dotPulse: true };
  }
  if (effectiveState === "STOPPING") {
    return { statusLabel: "App Compute Stopping", shortLabel: "Stopping", dotColorClass: "bg-warning", labelTextClass: "text-warning", dotPulse: true };
  }
  if (["UPDATING", "DELETING"].includes(effectiveState)) {
    return { statusLabel: "App Compute Pending", shortLabel: "Pending", dotColorClass: "bg-warning", labelTextClass: "text-warning", dotPulse: true };
  }
  if (effectiveState === "ACTIVE") {
    return { statusLabel: "App Compute Online", shortLabel: "Online", dotColorClass: "bg-success", labelTextClass: "text-success", dotPulse: false };
  }
  return { statusLabel: "App Compute Offline", shortLabel: "Offline", dotColorClass: "bg-destructive", labelTextClass: "text-destructive", dotPulse: false };
}

/** Distinguishes running application code from compute readiness and transitions. */
export function readWorkspaceAppStatus(
  app: IWorkspaceAppSummary | undefined,
): string {
  const transitions: Record<string, string> = {
    STARTING: "Starting compute",
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
