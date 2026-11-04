import { useQuery } from "@tanstack/react-query";
import { listWorkspaceTables } from "../api/workspaceResourcesApi";

export const workspaceTableKeys = {
  all: ["workspace-resources", "tables"] as const,
  bySchema: (catalogName: string, schemaName: string) =>
    [...workspaceTableKeys.all, catalogName, schemaName] as const,
};

/** Loads current-workspace tables and columns through the Node API boundary. */
export function useWorkspaceTables(
  catalogName: string | null,
  schemaName: string | null,
) {
  return useQuery({
    queryKey: workspaceTableKeys.bySchema(catalogName ?? "", schemaName ?? ""),
    queryFn: ({ signal }) =>
      listWorkspaceTables(catalogName ?? "", schemaName ?? "", signal),
    enabled:
      catalogName !== null &&
      catalogName.length > 0 &&
      schemaName !== null &&
      schemaName.length > 0,
  });
}
