import type {
  CallerIdentity,
  WorkspaceAppSummary,
  WorkspaceAppsPage,
} from "./contracts.ts";
import type {
  WorkspaceAppsClient,
  WorkspaceAppsQuery,
} from "./workspace-apps-client.ts";

/** Provides an explicit empty Apps response without contacting a workspace. */
export class LocalTestWorkspaceAppsClient implements WorkspaceAppsClient {
  async listApps(
    _caller: CallerIdentity,
    _query: WorkspaceAppsQuery,
  ): Promise<WorkspaceAppsPage> {
    return {
      items: [],
      nextPageToken: null,
      authenticationMode: "local-test",
    };
  }

  async getApp(
    _caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppSummary> {
    return localTestAppSummary(appName);
  }

  async startApp(
    _caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppSummary> {
    return { ...localTestAppSummary(appName), appState: "RUNNING", computeState: "ACTIVE" };
  }

  async stopApp(
    _caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppSummary> {
    return { ...localTestAppSummary(appName), appState: "UNAVAILABLE", computeState: "STOPPED" };
  }
}

function localTestAppSummary(appName: string): WorkspaceAppSummary {
  return {
    name: appName,
    description: null,
    appState: "UNAVAILABLE",
    computeState: "STOPPED",
  };
}
