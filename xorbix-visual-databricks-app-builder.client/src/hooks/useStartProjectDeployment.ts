import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startProjectDeployment } from "../api/projectDeploymentsApi";
import { projectDeploymentKeys } from "./useProjectDeployments";

/** Starts a new or linked child App deployment and refreshes its history. */
export function useStartProjectDeployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startProjectDeployment,
    onSettled: async (_result, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: projectDeploymentKeys.detail(input.projectId) });
    },
  });
}
