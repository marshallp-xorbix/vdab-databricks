import type {
  WorkspaceAppSummary,
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

  /** Reads one workspace App using the acting user's authorization. */
  async getApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary> {
    return this.workspaceAppsClient.getApp(caller, appName);
  }

  /** Starts a workspace App using the acting user's authorization. */
  async startApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary> {
    return this.workspaceAppsClient.startApp(caller, appName);
  }

  /** Stops a workspace App using the acting user's authorization. */
  async stopApp(caller: CallerIdentity, appName: string): Promise<WorkspaceAppSummary> {
    return this.workspaceAppsClient.stopApp(caller, appName);
  }
}
