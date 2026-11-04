import type { WorkspaceAiResourcesClient } from "./workspace-ai-resources-client.ts";
import { createWorkspaceAiResourcesClient } from "./workspace-ai-resources-client.ts";
import type { WorkspaceCatalogResourcesClient } from "./workspace-catalog-resources-client.ts";
import { createWorkspaceCatalogResourcesClient } from "./workspace-catalog-resources-client.ts";

/** Lists installed-workspace catalog, Genie, and serving resources. */
export interface WorkspaceResourcesClient
  extends WorkspaceCatalogResourcesClient, WorkspaceAiResourcesClient {}

/** Creates the workspace resource facade used by services and the HTTP layer. */
export function createWorkspaceResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceResourcesClient {
  return {
    ...createWorkspaceCatalogResourcesClient(
      workspaceHost,
      fetchImplementation,
    ),
    ...createWorkspaceAiResourcesClient(workspaceHost, fetchImplementation),
  };
}
