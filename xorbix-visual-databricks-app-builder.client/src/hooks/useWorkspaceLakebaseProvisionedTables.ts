import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseProvisionedTables } from "../api/workspaceLakebaseProvisionedResourcesApi";
import type { LakebaseProvisionedMetadataSelection } from "../models/WorkspaceLakebaseResources";

export const workspaceLakebaseProvisionedTableKeys = {
  bySchema: (selection: LakebaseProvisionedMetadataSelection | null, schemaName: string | null) => [
    "workspace-lakebase-provisioned",
    "tables",
    selection?.instanceName ?? "",
    selection?.databaseName ?? "",
    schemaName ?? "",
  ] as const,
};

/** Loads visible tables and columns from a selected Provisioned database schema. */
export function useWorkspaceLakebaseProvisionedTables(
  selection: LakebaseProvisionedMetadataSelection | null,
  schemaName: string | null,
) {
  return useQuery({
    queryKey: workspaceLakebaseProvisionedTableKeys.bySchema(selection, schemaName),
    queryFn: ({ signal }) => {
      if (!selection || !schemaName) throw new Error("Select a Lakebase Provisioned schema before loading tables.");
      return listWorkspaceLakebaseProvisionedTables(selection, schemaName, signal);
    },
    enabled: Boolean(selection && schemaName),
  });
}
