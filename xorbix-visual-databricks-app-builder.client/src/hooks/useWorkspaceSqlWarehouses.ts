import { useQuery } from "@tanstack/react-query";
import { listWorkspaceSqlWarehouses } from "../api/workspaceExecutionResourcesApi";

export const workspaceSqlWarehouseKeys = {
  all: ["workspace-resources", "sql-warehouses"] as const,
};

/** Loads SQL warehouses visible to the user in the installed workspace. */
export function useWorkspaceSqlWarehouses(enabled = true) {
  return useQuery({
    queryKey: workspaceSqlWarehouseKeys.all,
    queryFn: ({ signal }) => listWorkspaceSqlWarehouses(signal),
    enabled,
  });
}
