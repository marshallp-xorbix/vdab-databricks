import { useQuery } from "@tanstack/react-query";
import { listWorkspaceLakebaseProvisionedInstances } from "../api/workspaceLakebaseProvisionedResourcesApi";

export const workspaceLakebaseProvisionedInstanceKeys = {
  all: ["workspace-lakebase-provisioned", "instances"] as const,
};

/** Loads Provisioned instances visible in the workspace hosting this app. */
export function useWorkspaceLakebaseProvisionedInstances() {
  return useQuery({
    queryKey: workspaceLakebaseProvisionedInstanceKeys.all,
    queryFn: ({ signal }) => listWorkspaceLakebaseProvisionedInstances(signal),
  });
}
