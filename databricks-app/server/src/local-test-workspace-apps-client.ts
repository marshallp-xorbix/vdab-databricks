import type { CallerIdentity, WorkspaceAppsPage } from "./contracts.ts";
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
}
