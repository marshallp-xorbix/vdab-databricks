import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProjectResourceGrants } from "../api/projectDeploymentsApi";
import type { IWorkspaceAppDeploymentTarget } from "../models/ProjectDeployments";
import { workspaceAppDeploymentTargetKeys } from "./useWorkspaceAppDeploymentTarget";

/** Updates a linked child App and refreshes its displayed grant list. */
export function useUpdateProjectResourceGrants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectResourceGrants,
    onSuccess: (result) => {
      queryClient.setQueriesData<IWorkspaceAppDeploymentTarget | null>(
        { queryKey: workspaceAppDeploymentTargetKeys.all },
        (current) => {
          if (!current || current.name !== result.appName) return current;
          return {
            ...current,
            appResources: result.appResources,
            secretResources: result.appResources.filter(
              (resource): resource is Extract<
                typeof resource,
                { secret: unknown }
              > => "secret" in resource,
            ),
            unsupportedResourceCount: result.unsupportedResourceCount,
            appUpdateTime: result.appUpdateTime,
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: workspaceAppDeploymentTargetKeys.all,
      });
    },
  });
}
