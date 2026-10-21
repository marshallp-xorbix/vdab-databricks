import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseProjects } from "../api/workspaceLakebaseResourcesApi";

export const workspaceLakebaseProjectKeys = {
  all: ["workspace-lakebase", "projects"] as const,
};

/** Loads Lakebase projects visible in the current workspace. */
export function useWorkspaceLakebaseProjects() {
  return useQuery({
    queryKey: workspaceLakebaseProjectKeys.all,
    queryFn: ({ signal }) => listWorkspaceLakebaseProjects(signal),
  });
}
