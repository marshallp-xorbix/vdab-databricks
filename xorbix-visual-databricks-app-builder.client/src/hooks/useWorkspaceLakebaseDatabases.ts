import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseDatabases } from "../api/workspaceLakebaseResourcesApi";

export const workspaceLakebaseDatabaseKeys = {
  byBranch: (projectId: string, branchId: string) =>
    ["workspace-lakebase", "databases", projectId, branchId] as const,
};

/** Loads PostgreSQL databases visible in the selected Lakebase branch. */
export function useWorkspaceLakebaseDatabases(
  projectId: string | null,
  branchId: string | null,
) {
  return useQuery({
    queryKey: workspaceLakebaseDatabaseKeys.byBranch(projectId ?? "", branchId ?? ""),
    queryFn: ({ signal }) => listWorkspaceLakebaseDatabases(projectId ?? "", branchId ?? "", signal),
    enabled: Boolean(projectId && branchId),
  });
}
