import { useQuery } from "@tanstack/react-query";
import { listWorkspaceCatalogs } from "../api/workspaceResourcesApi";

export const workspaceCatalogKeys = {
  all: ["workspace-resources", "catalogs"] as const,
};

/** Loads current-workspace catalogs through the Node resource boundary. */
export function useWorkspaceCatalogs() {
  return useQuery({
    queryKey: workspaceCatalogKeys.all,
    queryFn: ({ signal }) => listWorkspaceCatalogs(signal),
  });
}
