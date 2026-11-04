import type {
  CallerIdentity,
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseDatabaseResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceLakebaseResourcesPage,
  WorkspaceLakebaseTableResource,
  WorkspaceResourcesPage,
} from "./contracts.ts";
import type { WorkspaceLakebaseResourcesClient } from "./workspace-lakebase-resources-client.ts";

/** Coordinates Lakebase discovery under the signed-in user's identity. */
export class WorkspaceLakebaseResourcesService {
  private readonly client: WorkspaceLakebaseResourcesClient;

  constructor(client: WorkspaceLakebaseResourcesClient) {
    this.client = client;
  }

  /** Lists Lakebase Autoscaling projects the acting user can view. */
  async listProjects(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseProjectResource>> {
    return this.createPage(caller, await this.client.listProjects(caller, signal));
  }

  /** Lists branches the acting user can view in a project. */
  async listBranches(
    caller: CallerIdentity,
    projectId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseBranchResource>> {
    return this.createPage(caller, await this.client.listBranches(caller, projectId, signal));
  }

  /** Lists endpoints the acting user can view in a branch. */
  async listEndpoints(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseEndpointResource>> {
    return this.createPage(caller, await this.client.listEndpoints(caller, projectId, branchId, signal));
  }

  /** Lists PostgreSQL databases the acting user can view in a branch. */
  async listDatabases(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseDatabaseResource>> {
    return this.createPage(caller, await this.client.listDatabases(caller, projectId, branchId));
  }

  /** Lists visible PostgreSQL schemas through a short-lived caller credential. */
  async listSchemas(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
  ): Promise<WorkspaceResourcesPage> {
    const names = await this.client.listSchemas(
      caller,
      projectId,
      branchId,
      endpointId,
      databaseName,
    );
    return {
      items: names.map((name) => ({ name })),
      authenticationMode: caller.authenticationMode,
    };
  }

  /** Lists visible PostgreSQL tables and columns through a caller credential. */
  async listTables(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
    schemaName: string,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseTableResource>> {
    return this.createPage(
      caller,
      await this.client.listTables(
        caller,
        projectId,
        branchId,
        endpointId,
        databaseName,
        schemaName,
      ),
    );
  }

  private createPage<T>(
    caller: CallerIdentity,
    items: T[],
  ): WorkspaceLakebaseResourcesPage<T> {
    return { items, authenticationMode: caller.authenticationMode };
  }
}
