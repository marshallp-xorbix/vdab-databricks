import { useQuery } from "@tanstack/react-query";
import { listWorkspaceJobs } from "../api/workspaceExecutionResourcesApi";

export const workspaceJobKeys = {
  all: ["workspace-resources", "jobs"] as const,
};

/** Loads Jobs visible to the signed-in user through the Node workspace boundary. */
export function useWorkspaceJobs() {
  return useQuery({
    queryKey: workspaceJobKeys.all,
    queryFn: ({ signal }) => listWorkspaceJobs(signal),
  });
}
