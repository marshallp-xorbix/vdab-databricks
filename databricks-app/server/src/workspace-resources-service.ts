import type {
  CallerIdentity,
  WorkspaceResourcesPage,
  WorkspaceGenieSpacesPage,
  WorkspaceServingEndpointsPage,
  WorkspaceTableSummariesPage,
  WorkspaceTablesPage,
} from "./contracts.ts";
import type { WorkspaceResourcesClient } from "./workspace-resources-client.ts";

/** Coordinates current-workspace discovery under the signed-in user's identity. */
export class WorkspaceResourcesService {
  private readonly workspaceResourcesClient: WorkspaceResourcesClient;

  constructor(workspaceResourcesClient: WorkspaceResourcesClient) {
    this.workspaceResourcesClient = workspaceResourcesClient;
  }

  /** Lists catalogs visible to the acting Databricks user. */
  async listCatalogs(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceResourcesPage> {
    return this.createPage(caller, await this.workspaceResourcesClient.listCatalogs(caller, signal));
  }

  /** Lists a bounded set of visible tables in one catalog. */
  async listTableSummaries(
    caller: CallerIdentity,
    catalogName: string,
    maxItems: number,
    signal?: AbortSignal,
  ): Promise<WorkspaceTableSummariesPage> {
    const result = await this.workspaceResourcesClient.listTableSummaries(
      caller,
      catalogName,
      maxItems,
      signal,
    );
    return { ...result, authenticationMode: caller.authenticationMode };
  }

  /** Lists schemas visible to the acting Databricks user in one catalog. */
  async listSchemas(
    caller: CallerIdentity,
    catalogName: string,
  ): Promise<WorkspaceResourcesPage> {
    return this.createPage(
      caller,
      await this.workspaceResourcesClient.listSchemas(caller, catalogName),
    );
  }

  /** Lists volumes visible to the acting Databricks user in one schema. */
  async listVolumes(
    caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceResourcesPage> {
    return this.createPage(
      caller,
      await this.workspaceResourcesClient.listVolumes(
        caller,
        catalogName,
        schemaName,
      ),
    );
  }

  /** Lists tables and their displayed column types visible in one schema. */
  async listTables(
    caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceTablesPage> {
    return {
      items: await this.workspaceResourcesClient.listTables(
        caller,
        catalogName,
        schemaName,
      ),
      authenticationMode: caller.authenticationMode,
    };
  }

  /** Lists Genie spaces visible to the acting Databricks user. */
  async listGenieSpaces(
    caller: CallerIdentity,
  ): Promise<WorkspaceGenieSpacesPage> {
    return {
      items: await this.workspaceResourcesClient.listGenieSpaces(caller),
      authenticationMode: caller.authenticationMode,
    };
  }

  /** Lists serving endpoints visible to the acting Databricks user. */
  async listServingEndpoints(
    caller: CallerIdentity,
  ): Promise<WorkspaceServingEndpointsPage> {
    return {
      items: await this.workspaceResourcesClient.listServingEndpoints(caller),
      authenticationMode: caller.authenticationMode,
    };
  }

  private createPage(
    caller: CallerIdentity,
    items: WorkspaceResourcesPage["items"],
  ): WorkspaceResourcesPage {
    return {
      items,
      authenticationMode: caller.authenticationMode,
    };
  }
}
