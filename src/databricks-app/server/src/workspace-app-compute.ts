import { setTimeout } from "node:timers/promises";
import { ApplicationError } from "./application-error.ts";

const COMPUTE_START_TIMEOUT_MS = 180_000;
const COMPUTE_POLL_INTERVAL_MS = 2_000;
const COMPLETED_DEPLOYMENT_STATES = new Set([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

interface AppComputeState {
  computeState: string | null;
  activeDeploymentState?: string | null;
  activeDeploymentId?: string | null;
  sourceCodePath?: string | null;
}

interface ComputeWaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Waits for existing child compute before redeploying a saved App. */
export async function waitForWorkspaceAppCompute(
  readApp: () => Promise<AppComputeState>,
  startApp: () => Promise<AppComputeState>,
  options: ComputeWaitOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? COMPUTE_START_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? COMPUTE_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  let app = await readApp();
  const previousDeploymentId = app.activeDeploymentId;
  const requiresRestartDeployment = Boolean(
    app.sourceCodePath &&
    (app.computeState !== "ACTIVE" || !previousDeploymentId),
  );
  let hasRequestedStart = false;
  while (
    !isReadyForDeployment(
      app,
      requiresRestartDeployment,
      previousDeploymentId,
    )
  ) {
    if (app.computeState === "STOPPED" && !hasRequestedStart) {
      hasRequestedStart = true;
      await startApp();
      app = await readApp();
      continue;
    }
    if (
      !["STARTING", "UPDATING", "STOPPED", "ACTIVE"].includes(
        app.computeState ?? "",
      )
    ) {
      throw new ApplicationError(
        409,
        "child_app_compute_unavailable",
        "Child App compute unavailable",
        "The child App compute cannot accept a deployment in its current state.",
      );
    }
    if (Date.now() >= deadline) {
      throw new ApplicationError(
        409,
        "child_app_compute_starting",
        "Child App compute is starting",
        "Databricks is still starting the child App compute. Retry the saved source when compute is active.",
      );
    }
    await setTimeout(
      Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())),
    );
    app = await readApp();
  }
}

function isReadyForDeployment(
  app: AppComputeState,
  requiresRestartDeployment: boolean,
  previousDeploymentId: string | null | undefined,
): boolean {
  if (
    app.computeState !== "ACTIVE" ||
    app.activeDeploymentState === "IN_PROGRESS"
  )
    return false;
  if (!requiresRestartDeployment) return true;
  return Boolean(
    app.activeDeploymentId &&
    app.activeDeploymentId !== previousDeploymentId &&
    COMPLETED_DEPLOYMENT_STATES.has(app.activeDeploymentState ?? ""),
  );
}
