import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseEndpoints } from "../api/workspaceLakebaseResourcesApi";

export const workspaceLakebaseEndpointKeys = {
  byBranch: (projectId: string, branchId: string) =>
    ["workspace-lakebase", "endpoints", projectId, branchId] as const,
};

/** Loads Lakebase endpoints visible in the selected branch. */
export function useWorkspaceLakebaseEndpoints(
  projectId: string | null,
  branchId: string | null,
) {
  return useQuery({
    queryKey: workspaceLakebaseEndpointKeys.byBranch(projectId ?? "", branchId ?? ""),
    queryFn: ({ signal }) => listWorkspaceLakebaseEndpoints(projectId ?? "", branchId ?? "", signal),
    enabled: Boolean(projectId && branchId),
  });
}
