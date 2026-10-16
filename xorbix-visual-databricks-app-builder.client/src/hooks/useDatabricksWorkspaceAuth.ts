import { useCallback } from "react";
import { appApi } from "../providers/AppApi";
import { databricksApi } from "../providers/DatabricksApi";
import { useIdentity } from "../context/IdentityContext";
import { startDatabricksAuthorization } from "../utils/databricksAuth";

/**
 * Returns a stable callback that starts the Databricks OAuth authorization flow
 * for the given app's workspace connection.
 *
 * Resolves the app, looks up its workspace connection within the current tenant,
 * and delegates to {@link startDatabricksAuthorization}. Throws when the app/user
 * context is missing, the app has no workspace connection, or the connection is
 * not part of the caller's tenant.
 *
 * @param appId The local app ID, or null/undefined when no app is selected.
 * @returns A memoized `authenticate` callback suitable for retry-on-auth flows.
 */
export const useDatabricksWorkspaceAuth = (
  appId?: number | null,
): (() => Promise<void>) => {
  const { user } = useIdentity();

  return useCallback(async () => {
    if (!appId || !user) {
      throw new Error("Missing app or user context for Databricks auth.");
    }

    const app = await appApi.getAppById(appId);
    const workspaceConnectionId = app.workspaceConnectionId;

    if (!workspaceConnectionId) {
      throw new Error("App does not have a workspace connection.");
    }

    const tenantConnections = await databricksApi.getWorkspacesByTenant();
    const tenantConnection = tenantConnections.find(
      (item) => item.pkId === workspaceConnectionId,
    );

    if (!tenantConnection) {
      throw new Error("Workspace connection not found for app.");
    }

    await startDatabricksAuthorization(tenantConnection);
  }, [appId, user]);
};
