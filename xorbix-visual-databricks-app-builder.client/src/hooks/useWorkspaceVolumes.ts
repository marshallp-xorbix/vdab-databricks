import { useQuery } from "@tanstack/react-query";
import { listWorkspaceVolumes } from "../api/workspaceResourcesApi";

export const workspaceVolumeKeys = {
  all: ["workspace-resources", "volumes"] as const,
  bySchema: (catalogName: string, schemaName: string) =>
    [...workspaceVolumeKeys.all, catalogName, schemaName] as const,
};

/** Loads volumes visible to the current user in the selected schema. */
export function useWorkspaceVolumes(
  catalogName: string | null,
  schemaName: string | null,
) {
  return useQuery({
    queryKey: workspaceVolumeKeys.bySchema(catalogName ?? "", schemaName ?? ""),
    queryFn: ({ signal }) =>
      listWorkspaceVolumes(catalogName ?? "", schemaName ?? "", signal),
    enabled:
      catalogName !== null &&
      catalogName.length > 0 &&
      schemaName !== null &&
      schemaName.length > 0,
  });
}
