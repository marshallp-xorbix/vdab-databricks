import type {
  CallerIdentity,
  WorkspaceExperimentResource,
  WorkspaceGenieSpaceResource,
  WorkspaceResource,
  WorkspaceSecretScopeResource,
  WorkspaceServingEndpointResource,
  WorkspaceTableSummariesResult,
  WorkspaceTableResource,
} from "./contracts.ts";
import type { WorkspaceResourcesClient } from "./workspace-resources-client.ts";

/** Returns deterministic resource names without contacting a workspace. */
export class LocalTestWorkspaceResourcesClient implements WorkspaceResourcesClient {
  async listGenieSpaces(_caller: CallerIdentity): Promise<WorkspaceGenieSpaceResource[]> {
    return [{
      spaceId: "0123456789abcdef0123456789abcdef",
      title: "Sample Genie Space",
    }];
  }

  async listServingEndpoints(
    _caller: CallerIdentity,
  ): Promise<WorkspaceServingEndpointResource[]> {
    return [{
      name: "sample-chat-endpoint",
      task: "llm/v1/chat",
      readiness: "ready",
      permissionLevel: "CAN_QUERY",
    }];
  }

  async listSecretScopes(
    _caller: CallerIdentity,
  ): Promise<WorkspaceSecretScopeResource[]> {
    return [{ name: "service-scope" }];
  }

  async listSecretKeys(
    _caller: CallerIdentity,
    secretScope: string,
  ): Promise<WorkspaceSecretScopeResource[]> {
    return secretScope === "service-scope" ? [{ name: "api-key" }] : [];
  }

  async listExperiments(
    _caller: CallerIdentity,
  ): Promise<WorkspaceExperimentResource[]> {
    return [{ experimentId: "1021971371025173", name: "/Users/sample/demo" }];
  }

  async listCatalogs(_caller: CallerIdentity): Promise<WorkspaceResource[]> {
    return [{ name: "main" }];
  }

  async listTableSummaries(
    _caller: CallerIdentity,
    catalogName: string,
    maxItems: number,
  ): Promise<WorkspaceTableSummariesResult> {
    const items = catalogName === "main"
      ? [{ fullName: "main.default.customers" }]
      : [];
    return { items: items.slice(0, maxItems), hasMore: items.length > maxItems };
  }

  async listSchemas(
    _caller: CallerIdentity,
    catalogName: string,
  ): Promise<WorkspaceResource[]> {
    return catalogName === "main" ? [{ name: "default" }] : [];
  }

  async listVolumes(
    _caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceResource[]> {
    return catalogName === "main" && schemaName === "default"
      ? [{ name: "uploads" }]
      : [];
  }

  async listTables(
    _caller: CallerIdentity,
    catalogName: string,
    schemaName: string,
  ): Promise<WorkspaceTableResource[]> {
    return catalogName === "main" && schemaName === "default"
      ? [{
          name: "customers",
          dataSourceFormat: "DELTA",
          columns: [
            { name: "customer_id", type: "BIGINT", dataType: "LONG" },
            { name: "customer_name", type: "STRING", dataType: "STRING" },
          ],
        }]
      : [];
  }
}
