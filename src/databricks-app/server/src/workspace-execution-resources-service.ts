import type {
  CallerIdentity,
  WorkspaceJobsPage,
  WorkspaceSqlWarehousesPage,
} from "./contracts.ts";
import type { WorkspaceExecutionResourcesClient } from "./workspace-execution-resources-client.ts";

/** Coordinates current-workspace Jobs and SQL warehouse discovery. */
export class WorkspaceExecutionResourcesService {
  private readonly client: WorkspaceExecutionResourcesClient;

  constructor(client: WorkspaceExecutionResourcesClient) {
    this.client = client;
  }

  /** Lists Jobs visible to the signed-in Databricks user. */
  async listJobs(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceJobsPage> {
    return {
      items: await this.client.listJobs(caller, signal),
      authenticationMode: caller.authenticationMode,
    };
  }

  /** Lists SQL warehouses visible to the signed-in Databricks user. */
  async listSqlWarehouses(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceSqlWarehousesPage> {
    return {
      items: await this.client.listSqlWarehouses(caller, signal),
      authenticationMode: caller.authenticationMode,
    };
  }
}
