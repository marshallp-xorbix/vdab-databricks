import type {
  CallerIdentity,
  WorkspaceLakebaseProvisionedInstanceResource,
  WorkspaceLakebaseResourcesPage,
  WorkspaceLakebaseTableResource,
  WorkspaceResourcesPage,
} from "./contracts.ts";
import type { WorkspaceLakebaseProvisionedResourcesClient } from "./workspace-lakebase-provisioned-resources-client.ts";

/** Coordinates legacy Provisioned Lakebase discovery for the installed workspace. */
export class WorkspaceLakebaseProvisionedResourcesService {
  private readonly client: WorkspaceLakebaseProvisionedResourcesClient;

  constructor(client: WorkspaceLakebaseProvisionedResourcesClient) {
    this.client = client;
  }

  /** Lists legacy Provisioned instances visible to the acting user. */
  async listInstances(
    caller: CallerIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseProvisionedInstanceResource>> {
    return this.createPage(caller, await this.client.listInstances(caller, signal));
  }

  /** Lists visible PostgreSQL schemas through a short-lived caller credential. */
  async listSchemas(
    caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceResourcesPage> {
    const names = await this.client.listSchemas(caller, instanceName, databaseName, signal);
    return {
      items: names.map((name) => ({ name })),
      authenticationMode: caller.authenticationMode,
    };
  }

  /** Lists visible PostgreSQL tables and columns through a caller credential. */
  async listTables(
    caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
    schemaName: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseResourcesPage<WorkspaceLakebaseTableResource>> {
    return this.createPage(
      caller,
      await this.client.listTables(caller, instanceName, databaseName, schemaName, signal),
    );
  }

  private createPage<T>(
    caller: CallerIdentity,
    items: T[],
  ): WorkspaceLakebaseResourcesPage<T> {
    return { items, authenticationMode: caller.authenticationMode };
  }
}
