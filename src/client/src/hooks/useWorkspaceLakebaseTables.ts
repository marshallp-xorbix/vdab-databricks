import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseTables } from "../api/workspaceLakebaseResourcesApi";
import type { LakebaseMetadataSelection } from "../models/WorkspaceLakebaseResources";

export const workspaceLakebaseTableKeys = {
  bySchema: (selection: LakebaseMetadataSelection | null, schemaName: string | null) =>
    [
      "workspace-lakebase",
      "tables",
      selection?.projectId ?? "",
      selection?.branchId ?? "",
      selection?.endpointId ?? "",
      selection?.databaseName ?? "",
      schemaName ?? "",
    ] as const,
};

/** Loads visible PostgreSQL tables and column metadata in one schema. */
export function useWorkspaceLakebaseTables(
  selection: LakebaseMetadataSelection | null,
  schemaName: string | null,
) {
  return useQuery({
    queryKey: workspaceLakebaseTableKeys.bySchema(selection, schemaName),
    queryFn: ({ signal }) => {
      if (!selection || !schemaName) {
        throw new Error("Select a Lakebase schema before loading tables.");
      }
      return listWorkspaceLakebaseTables(selection, schemaName, signal);
    },
    enabled: Boolean(selection && schemaName),
  });
}
