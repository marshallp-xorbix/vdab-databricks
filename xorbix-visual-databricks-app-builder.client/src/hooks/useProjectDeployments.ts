import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getProjectDeployment, getProjectDeploymentHistory } from "../api/projectDeploymentsApi";
import type { IProjectDeploymentHistory, IProjectDeploymentSummary } from "../models/ProjectDeployments";

export const projectDeploymentKeys = {
  all: ["project-deployments"] as const,
  detail: (projectId: string) => [...projectDeploymentKeys.all, projectId] as const,
  deployment: (projectId: string, deploymentId: string) =>
    [...projectDeploymentKeys.detail(projectId), deploymentId] as const,
};

/** Loads linked App and history; refreshes while Databricks reports an active deployment. */
export function useProjectDeployments(projectId: string | undefined) {
  return useQuery({
    queryKey: projectDeploymentKeys.detail(projectId ?? ""),
    queryFn: ({ signal }) => getProjectDeploymentHistory(projectId ?? "", signal),
    enabled: Boolean(projectId),
  });
}

/** Polls an active workspace deployment and mirrors its state into project history. */
export function useProjectDeployment(
  projectId: string,
  deployment: IProjectDeploymentSummary,
) {
  const queryClient = useQueryClient();
  const deploymentQuery = useQuery({
    queryKey: projectDeploymentKeys.deployment(projectId, deployment.id),
    queryFn: ({ signal }) => getProjectDeployment(projectId, deployment.id, signal),
    initialData: deployment,
    refetchInterval: (query) => {
      const current = query.state.data;
      return current?.deploymentId && (current.status === "pending" || current.status === "running")
        ? 3000
        : false;
    },
  });

  useEffect(() => {
    const updatedDeployment = deploymentQuery.data;
    if (!updatedDeployment) return;
    queryClient.setQueryData<IProjectDeploymentHistory>(projectDeploymentKeys.detail(projectId), (history) => {
      if (!history) return history;
      const previous = history.items.find((item) => item.id === updatedDeployment.id);
      if (
        !previous ||
        (previous.status === updatedDeployment.status &&
          previous.deploymentId === updatedDeployment.deploymentId &&
          previous.failureCode === updatedDeployment.failureCode &&
          previous.completedAt === updatedDeployment.completedAt)
      ) {
        return history;
      }
      return {
        ...history,
        items: history.items.map((item) => item.id === updatedDeployment.id ? updatedDeployment : item),
      };
    });
  }, [deploymentQuery.data, projectId, queryClient]);

  return deploymentQuery;
}
