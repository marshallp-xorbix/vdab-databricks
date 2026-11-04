import { useQuery } from "@tanstack/react-query";
import { listWorkspaceGenieSpaces } from "../api/workspaceResourcesApi";

export const workspaceGenieSpaceKeys = {
  all: ["workspace-resources", "genie-spaces"] as const,
};

/** Loads Genie spaces visible to the current user through the Node boundary. */
export function useWorkspaceGenieSpaces() {
  return useQuery({
    queryKey: workspaceGenieSpaceKeys.all,
    queryFn: ({ signal }) => listWorkspaceGenieSpaces(signal),
  });
}
