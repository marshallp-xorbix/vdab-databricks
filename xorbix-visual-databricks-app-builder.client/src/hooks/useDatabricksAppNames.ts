import { useCallback, useEffect, useRef, useState } from "react";
import { appActionApi } from "../providers/AppActionApi";
import { ApiError } from "../models/ApiError";

export type DatabricksAppNamesLoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

export interface UseDatabricksAppNamesResult {
  appNames: string[];
  loadState: DatabricksAppNamesLoadState;
  errorMessage: string | null;
}

function formatListError(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { detail?: string; title?: string } | undefined;
    if (data && typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }
    return error.message || "Failed to load Databricks apps.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load Databricks apps.";
}

/**
 * Loads Databricks app names when a workspace connection is selected.
 * - App Settings: pass both `appId` and `workspaceConnectionId` (uses `/api/AppActions/{appId}/databricks-app-names`).
 * - Create flow / no VDAB app yet: pass `appId` null and a `workspaceConnectionId` (uses `/api/AppActions/databricks-app-names`).
 * Clears results when inputs are insufficient; refetches when `appId` or `workspaceConnectionId` changes.
 */
export function useDatabricksAppNames(
  appId: number | null,
  workspaceConnectionId: number | null,
): UseDatabricksAppNamesResult {
  const [appNames, setAppNames] = useState<string[]>([]);
  const [loadState, setLoadState] =
    useState<DatabricksAppNamesLoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!workspaceConnectionId) {
      setAppNames([]);
      setErrorMessage(null);
      setLoadState("idle");
      return;
    }

    if (appId == null || appId <= 0) {
      const currentIdWorkspaceOnly = ++requestIdRef.current;
      setAppNames([]);
      setErrorMessage(null);
      setLoadState("loading");

      try {
        const response = await appActionApi.listDatabricksAppNamesByWorkspace(
          workspaceConnectionId,
        );
        if (currentIdWorkspaceOnly !== requestIdRef.current) {
          return;
        }
        setAppNames(response.appNames ?? []);
        setLoadState("success");
      } catch (e) {
        if (currentIdWorkspaceOnly !== requestIdRef.current) {
          return;
        }
        setAppNames([]);
        setErrorMessage(formatListError(e));
        setLoadState("error");
      }
      return;
    }

    const currentId = ++requestIdRef.current;
    setAppNames([]);
    setErrorMessage(null);
    setLoadState("loading");

    try {
      const response = await appActionApi.listDatabricksAppNames(
        appId,
        workspaceConnectionId,
      );
      if (currentId !== requestIdRef.current) {
        return;
      }
      setAppNames(response.appNames ?? []);
      setLoadState("success");
    } catch (e) {
      if (currentId !== requestIdRef.current) {
        return;
      }
      setAppNames([]);
      setErrorMessage(formatListError(e));
      setLoadState("error");
    }
  }, [appId, workspaceConnectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { appNames, loadState, errorMessage };
}
