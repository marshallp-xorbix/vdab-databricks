import { useQuery } from "@tanstack/react-query";
import { listWorkspaceSchemas } from "../api/workspaceResourcesApi";

export const workspaceSchemaKeys = {
  all: ["workspace-resources", "schemas"] as const,
  byCatalog: (catalogName: string) =>
    [...workspaceSchemaKeys.all, catalogName] as const,
};

/** Loads schemas visible to the current user in the selected catalog. */
export function useWorkspaceSchemas(catalogName: string | null) {
  return useQuery({
    queryKey: workspaceSchemaKeys.byCatalog(catalogName ?? ""),
    queryFn: ({ signal }) => listWorkspaceSchemas(catalogName ?? "", signal),
    enabled: catalogName !== null && catalogName.length > 0,
  });
}
