import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseProvisionedSchemas } from "../api/workspaceLakebaseProvisionedResourcesApi";
import type { LakebaseProvisionedMetadataSelection } from "../models/WorkspaceLakebaseResources";

export const workspaceLakebaseProvisionedSchemaKeys = {
  byDatabase: (selection: LakebaseProvisionedMetadataSelection | null) => [
    "workspace-lakebase-provisioned",
    "schemas",
    selection?.instanceName ?? "",
    selection?.databaseName ?? "",
  ] as const,
};

/** Loads visible schemas from the selected Provisioned database. */
export function useWorkspaceLakebaseProvisionedSchemas(
  selection: LakebaseProvisionedMetadataSelection | null,
) {
  return useQuery({
    queryKey: workspaceLakebaseProvisionedSchemaKeys.byDatabase(selection),
    queryFn: ({ signal }) => {
      if (!selection) throw new Error("Select a Lakebase Provisioned database before loading schemas.");
      return listWorkspaceLakebaseProvisionedSchemas(selection, signal);
    },
    enabled: Boolean(selection),
  });
}
