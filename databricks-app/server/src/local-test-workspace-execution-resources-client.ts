import type {
  CallerIdentity,
  WorkspaceJobResource,
  WorkspaceSqlWarehouseResource,
} from "./contracts.ts";
import type { WorkspaceExecutionResourcesClient } from "./workspace-execution-resources-client.ts";

/** Returns repeatable workflow resources without contacting a workspace. */
export class LocalTestWorkspaceExecutionResourcesClient
  implements WorkspaceExecutionResourcesClient
{
  async listJobs(_caller: CallerIdentity): Promise<WorkspaceJobResource[]> {
    return [{ jobId: "1001", name: "Sample refresh job" }];
  }

  async listSqlWarehouses(
    _caller: CallerIdentity,
  ): Promise<WorkspaceSqlWarehouseResource[]> {
    return [{ id: "sample-warehouse", name: "Sample SQL warehouse", state: "running" }];
  }
}
