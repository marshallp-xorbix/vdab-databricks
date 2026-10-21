import type {
  CallerIdentity,
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseDatabaseResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";
import type { WorkspaceLakebaseResourcesClient } from "./workspace-lakebase-resources-client.ts";

/** Returns deterministic Lakebase resources without contacting a workspace. */
export class LocalTestWorkspaceLakebaseResourcesClient
  implements WorkspaceLakebaseResourcesClient
{
  async listProjects(_caller: CallerIdentity): Promise<WorkspaceLakebaseProjectResource[]> {
    return [{ projectId: "sample-project", displayName: "Sample Lakebase project" }];
  }

  async listBranches(
    _caller: CallerIdentity,
    projectId: string,
  ): Promise<WorkspaceLakebaseBranchResource[]> {
    return projectId === "sample-project"
      ? [{ branchId: "production", isDefault: true, state: "ready" }]
      : [];
  }

  async listEndpoints(
    _caller: CallerIdentity,
    projectId: string,
    branchId: string,
  ): Promise<WorkspaceLakebaseEndpointResource[]> {
    return projectId === "sample-project" && branchId === "production"
      ? [{ endpointId: "primary", endpointType: "read-write", state: "active" }]
      : [];
  }

  async listDatabases(
    _caller: CallerIdentity,
    projectId: string,
    branchId: string,
  ): Promise<WorkspaceLakebaseDatabaseResource[]> {
    return projectId === "sample-project" && branchId === "production"
      ? [{ databaseId: "databricks_postgres", databaseName: "databricks_postgres" }]
      : [];
  }

  async listSchemas(
    _caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
  ): Promise<string[]> {
    return isSampleDatabase(projectId, branchId, endpointId, databaseName)
      ? ["public"]
      : [];
  }

  async listTables(
    _caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
    schemaName: string,
  ): Promise<WorkspaceLakebaseTableResource[]> {
    return isSampleDatabase(projectId, branchId, endpointId, databaseName) && schemaName === "public"
      ? [{
          name: "sample_records",
          tableType: "BASE TABLE",
          columns: [
            { name: "record_id", type: "integer", nullable: false },
            { name: "record_name", type: "text", nullable: false },
          ],
        }]
      : [];
  }
}

function isSampleDatabase(
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
): boolean {
  return projectId === "sample-project" &&
    branchId === "production" &&
    endpointId === "primary" &&
    databaseName === "databricks_postgres";
}
