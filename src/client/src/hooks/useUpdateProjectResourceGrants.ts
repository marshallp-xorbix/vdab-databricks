import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProjectResourceGrants } from "../api/projectDeploymentsApi";
import { workspaceAppDeploymentTargetKeys } from "./useWorkspaceAppDeploymentTarget";

/** Updates a linked child App and refreshes its displayed grant list. */
export function useUpdateProjectResourceGrants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectResourceGrants,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: workspaceAppDeploymentTargetKeys.all,
      }),
  });
}
