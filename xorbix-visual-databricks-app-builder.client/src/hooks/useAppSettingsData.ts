import { useCallback, useEffect, useState } from "react";
import { databricksApi } from "../providers/DatabricksApi";
import { appActionApi } from "../providers/AppActionApi";
import type { DatabricksConnection } from "../models";
import { ApiError } from "../models/ApiError";
import type {
  AppSettingsWarning,
  NormalizedAppResource,
} from "../models/DatabricksAppModels";
import { useLogger } from "../logger/useLogger";

interface UseAppSettingsDataParams {
  /** The databricks app name (from AppDto), used to decide if we should fetch Databricks resources */
  databricksAppName: string;
  /** The VDAB app ID, used to fetch Databricks app details */
  appId: number | null;
}

function formatResourcesFetchError(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { detail?: string; title?: string } | undefined;
    if (data && typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }
    return error.message || "Failed to load Databricks app resources.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load Databricks app resources.";
}

interface UseAppSettingsDataResult {
  /** Available workspace connections for the tenant */
  workspaceConnections: DatabricksConnection[];
  /** Normalized resources from appSettings only (GET /api/AppActions/{id}/details). */
  normalizedResources: NormalizedAppResource[];
  /** Warnings from appSettings (e.g. unknown resource type keys). */
  appSettingsWarnings: AppSettingsWarning[];
  /** Compute size from appSettings.computeSize only. */
  appSettingsComputeSize: string;
  /** Databricks app `update_time` from last successful details fetch (concurrency token). */
  databricksAppUpdateTime: string;
  /** Whether connections are currently loading */
  connectionsLoading: boolean;
  /** Whether Databricks app details are currently loading */
  resourcesLoading: boolean;
  /** Set when getAppDetails fails; cleared on success. */
  resourcesError: string | null;
  /** Reload workspace connections */
  reloadConnections: () => Promise<void>;
  /** Reload Databricks app resources (details) */
  reloadDatabricksResources: () => Promise<void>;
}

/**
 * Reusable hook for fetching Databricks workspace connections and app resources.
 * Resources for display use appSettings from app details only (not legacy root fields).
 */
export function useAppSettingsData({
  databricksAppName,
  appId,
}: UseAppSettingsDataParams): UseAppSettingsDataResult {
  const logger = useLogger("useAppSettingsData");
  const [workspaceConnections, setWorkspaceConnections] = useState<
    DatabricksConnection[]
  >([]);
  const [normalizedResources, setNormalizedResources] = useState<
    NormalizedAppResource[]
  >([]);
  const [appSettingsWarnings, setAppSettingsWarnings] = useState<
    AppSettingsWarning[]
  >([]);
  const [appSettingsComputeSize, setAppSettingsComputeSize] =
    useState<string>("");
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [databricksAppUpdateTime, setDatabricksAppUpdateTime] =
    useState<string>("");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const reloadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const connections = await databricksApi.getWorkspacesByTenant();
      setWorkspaceConnections(connections);
    } catch (error) {
      logger.UI.error("Failed to load workspace connections:", error);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const reloadDatabricksResources = useCallback(async () => {
    if (!appId || !databricksAppName) {
      setNormalizedResources([]);
      setAppSettingsWarnings([]);
      setAppSettingsComputeSize("");
      setDatabricksAppUpdateTime("");
      setResourcesError(null);
      return;
    }

    setResourcesLoading(true);
    setResourcesError(null);
    try {
      const databricksApp = await appActionApi.getAppDetails(appId);
      const appSettings = databricksApp.appSettings;
      setNormalizedResources(appSettings?.resources ?? []);
      setAppSettingsWarnings(appSettings?.warnings ?? []);
      setAppSettingsComputeSize(appSettings?.computeSize ?? "");
      setDatabricksAppUpdateTime(databricksApp.update_time?.trim() ?? "");
    } catch (error) {
      logger.UI.error("Failed to fetch Databricks app resources:", error);
      setNormalizedResources([]);
      setAppSettingsWarnings([]);
      setAppSettingsComputeSize("");
      setDatabricksAppUpdateTime("");
      setResourcesError(formatResourcesFetchError(error));
    } finally {
      setResourcesLoading(false);
    }
  }, [appId, databricksAppName]);

  useEffect(() => {
    reloadConnections();
  }, [reloadConnections]);

  useEffect(() => {
    reloadDatabricksResources();
  }, [reloadDatabricksResources]);

  return {
    workspaceConnections,
    normalizedResources,
    appSettingsWarnings,
    appSettingsComputeSize,
    databricksAppUpdateTime,
    connectionsLoading,
    resourcesLoading,
    resourcesError,
    reloadConnections,
    reloadDatabricksResources,
  };
}
