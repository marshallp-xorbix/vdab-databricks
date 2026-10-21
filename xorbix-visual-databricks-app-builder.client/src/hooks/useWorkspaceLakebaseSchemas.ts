import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseSchemas } from "../api/workspaceLakebaseResourcesApi";
import type { LakebaseMetadataSelection } from "../models/WorkspaceLakebaseResources";

export const workspaceLakebaseSchemaKeys = {
  byDatabase: (selection: LakebaseMetadataSelection | null) =>
    [
      "workspace-lakebase",
      "schemas",
      selection?.projectId ?? "",
      selection?.branchId ?? "",
      selection?.endpointId ?? "",
      selection?.databaseName ?? "",
    ] as const,
};

/** Loads visible PostgreSQL schemas for the selected Lakebase database. */
export function useWorkspaceLakebaseSchemas(selection: LakebaseMetadataSelection | null) {
  return useQuery({
    queryKey: workspaceLakebaseSchemaKeys.byDatabase(selection),
    queryFn: ({ signal }) => {
      if (!selection) {
        throw new Error("Select a Lakebase database before loading schemas.");
      }
      return listWorkspaceLakebaseSchemas(selection, signal);
    },
    enabled: Boolean(selection),
  });
}
