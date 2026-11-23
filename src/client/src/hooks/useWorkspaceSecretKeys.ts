import { useQuery } from "@tanstack/react-query";
import { listWorkspaceSecretKeys } from "../api/workspaceResourcesApi";

export const workspaceSecretKeyKeys = {
  all: ["workspace-resources", "secret-keys"] as const,
  byScope: (secretScope: string) =>
    [...workspaceSecretKeyKeys.all, secretScope] as const,
};

/** Loads secret keys for one scope through the Node boundary. */
export function useWorkspaceSecretKeys(secretScope: string | null) {
  return useQuery({
    queryKey: workspaceSecretKeyKeys.byScope(secretScope ?? ""),
    queryFn: ({ signal }) => listWorkspaceSecretKeys(secretScope ?? "", signal),
    enabled: Boolean(secretScope),
  });
}
