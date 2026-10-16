import { appActionApi } from "../providers/AppActionApi";
import { getDatabricksComputeStatePresentation } from "../components/AppBuilderComponents/builderHeaderComputeStatus";
import type { DatabricksConnectionStatusDto } from "../models";

export type AppManagementStatusRow =
  | { kind: "loading" }
  | { kind: "draft" }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | {
      kind: "compute";
      label: string;
      dotClass: string;
      labelTextClass: string;
      pulse: boolean;
    };

export interface AppForStatusCheck {
  id: string;
  workspaceConnectionId: number;
  databricksAppName?: string;
}

/**
 * Resolves the status row for an app on the Apps list: Draft / Unauthorized / Error / live compute state.
 */
export async function resolveAppManagementStatusRow(
  app: AppForStatusCheck,
  connectionById: Map<number, DatabricksConnectionStatusDto>,
): Promise<AppManagementStatusRow> {
  if (!app.workspaceConnectionId || app.workspaceConnectionId <= 0) {
    return { kind: "draft" };
  }

  if (!app.databricksAppName?.trim()) {
    return { kind: "draft" };
  }

  const connection = connectionById.get(app.workspaceConnectionId);
  if (!connection) {
    return { kind: "error" };
  }

  if (!connection.isAuthorized) {
    return { kind: "unauthorized" };
  }

  try {
    const numericId = Number.parseInt(app.id, 10);
    if (Number.isNaN(numericId)) {
      return { kind: "error" };
    }

    const status = await appActionApi.getAppStatus(numericId);
    const effectiveState = (status.state ?? "").trim().toUpperCase();
    const visual = getDatabricksComputeStatePresentation(effectiveState);
    return {
      kind: "compute",
      label: visual.shortLabel,
      dotClass: visual.dotColorClass,
      labelTextClass: visual.labelTextClass,
      pulse: visual.dotPulse,
    };
  } catch {
    return { kind: "error" };
  }
}
