import { useQuery } from "@tanstack/react-query";
import { listWorkspaceExperiments } from "../api/workspaceResourcesApi";

export const workspaceExperimentKeys = {
  all: ["workspace-resources", "experiments"] as const,
};

/** Loads MLflow experiments visible to the current user through the Node boundary. */
export function useWorkspaceExperiments(enabled = true) {
  return useQuery({
    queryKey: workspaceExperimentKeys.all,
    queryFn: ({ signal }) => listWorkspaceExperiments(signal),
    enabled,
  });
}
