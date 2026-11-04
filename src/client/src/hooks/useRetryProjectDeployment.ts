import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryProjectDeployment } from "../api/projectDeploymentsApi";
import { projectDeploymentKeys } from "./useProjectDeployments";

/** Retries a failed child App deployment from its saved source snapshot. */
export function useRetryProjectDeployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryProjectDeployment,
    onSettled: async (_result, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: projectDeploymentKeys.detail(input.projectId) });
    },
  });
}
