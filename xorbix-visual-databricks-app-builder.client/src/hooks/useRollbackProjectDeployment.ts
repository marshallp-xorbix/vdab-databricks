import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rollbackProjectDeployment } from "../api/projectDeploymentsApi";
import { projectDeploymentKeys } from "./useProjectDeployments";

/** Restores the selected successful child App snapshot with user confirmation. */
export function useRollbackProjectDeployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rollbackProjectDeployment,
    onSettled: async (_result, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: projectDeploymentKeys.detail(input.projectId) });
    },
  });
}
