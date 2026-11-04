import { useQuery } from "@tanstack/react-query";
import { listWorkspaceServingEndpoints } from "../api/workspaceResourcesApi";

export const workspaceServingEndpointKeys = {
  all: ["workspace-resources", "serving-endpoints"] as const,
};

/** Loads serving endpoints visible to the current user through the Node boundary. */
export function useWorkspaceServingEndpoints() {
  return useQuery({
    queryKey: workspaceServingEndpointKeys.all,
    queryFn: ({ signal }) => listWorkspaceServingEndpoints(signal),
  });
}
