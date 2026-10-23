import { useQuery } from "@tanstack/react-query";
import { getWorkspaceAppDeploymentTarget } from "../api/projectDeploymentsApi";

export const workspaceAppDeploymentTargetKeys = {
  all: ["workspace-app-deployment-targets"] as const,
  detail: (appName: string) => [...workspaceAppDeploymentTargetKeys.all, appName] as const,
};

/** Loads current workspace App details only after a user selects a target. */
export function useWorkspaceAppDeploymentTarget(appName: string | undefined) {
  return useQuery({
    queryKey: workspaceAppDeploymentTargetKeys.detail(appName ?? ""),
    queryFn: ({ signal }) => getWorkspaceAppDeploymentTarget(appName ?? "", signal),
    enabled: Boolean(appName),
    staleTime: 0,
  });
}
