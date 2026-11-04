import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseBranches } from "../api/workspaceLakebaseResourcesApi";

export const workspaceLakebaseBranchKeys = {
  byProject: (projectId: string) => ["workspace-lakebase", "branches", projectId] as const,
};

/** Loads Lakebase branches visible in the selected project. */
export function useWorkspaceLakebaseBranches(projectId: string | null) {
  return useQuery({
    queryKey: workspaceLakebaseBranchKeys.byProject(projectId ?? ""),
    queryFn: ({ signal }) => listWorkspaceLakebaseBranches(projectId ?? "", signal),
    enabled: projectId !== null && projectId.length > 0,
  });
}
