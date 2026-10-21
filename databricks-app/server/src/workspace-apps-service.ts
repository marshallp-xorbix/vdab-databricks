import type {
  CallerIdentity,
  WorkspaceAppsPage,
} from "./contracts.ts";
import type {
  WorkspaceAppsClient,
  WorkspaceAppsQuery,
} from "./workspace-apps-client.ts";

/** Coordinates caller-authorized app discovery in the installed workspace. */
export class WorkspaceAppsService {
  private readonly workspaceAppsClient: WorkspaceAppsClient;

  constructor(workspaceAppsClient: WorkspaceAppsClient) {
    this.workspaceAppsClient = workspaceAppsClient;
  }

  /** Lists the Apps visible to the acting Databricks user. */
  async listApps(
    caller: CallerIdentity,
    query: WorkspaceAppsQuery,
  ): Promise<WorkspaceAppsPage> {
    const page = await this.workspaceAppsClient.listApps(caller, query);

    return {
      ...page,
      authenticationMode: caller.authenticationMode,
    };
  }
}
