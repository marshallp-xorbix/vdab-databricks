import { useQuery } from "@tanstack/react-query";
import { listWorkspaceSecretScopes } from "../api/workspaceResourcesApi";

export const workspaceSecretScopeKeys = {
  all: ["workspace-resources", "secret-scopes"] as const,
};

/** Loads secret scopes visible to the current user through the Node boundary. */
export function useWorkspaceSecretScopes(enabled = true) {
  return useQuery({
    queryKey: workspaceSecretScopeKeys.all,
    queryFn: ({ signal }) => listWorkspaceSecretScopes(signal),
    enabled,
  });
}
