import type { WorkspaceAiResourcesClient } from "./workspace-ai-resources-client.ts";
import { createWorkspaceAiResourcesClient } from "./workspace-ai-resources-client.ts";
import type { WorkspaceCatalogResourcesClient } from "./workspace-catalog-resources-client.ts";
import { createWorkspaceCatalogResourcesClient } from "./workspace-catalog-resources-client.ts";
import type { WorkspaceSecretExperimentResourcesClient } from "./workspace-secret-experiment-resources-client.ts";
import { createWorkspaceSecretExperimentResourcesClient } from "./workspace-secret-experiment-resources-client.ts";

/** Lists installed-workspace catalog, Genie, serving, secret, and experiment resources. */
export interface WorkspaceResourcesClient
  extends
    WorkspaceCatalogResourcesClient,
    WorkspaceAiResourcesClient,
    WorkspaceSecretExperimentResourcesClient {}

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
    ...createWorkspaceSecretExperimentResourcesClient(
      workspaceHost,
      fetchImplementation,
    ),
  };
}
