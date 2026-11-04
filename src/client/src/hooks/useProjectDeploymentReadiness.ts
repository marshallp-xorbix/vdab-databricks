import { useQuery } from "@tanstack/react-query";
import { getProjectDeploymentReadiness } from "../api/projectDeploymentsApi";

/** Loads the saved project's local deployment prerequisites and scope set. */
export function useProjectDeploymentReadiness(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-deployment-readiness", projectId ?? ""],
    queryFn: ({ signal }) => getProjectDeploymentReadiness(projectId ?? "", signal),
    enabled: Boolean(projectId),
  });
}
